"""Discover INSP (insp.gov.ro) pages related to babies / childhood and sync into RAG."""
from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

import requests
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env", override=False)
load_dotenv(_ROOT / "backend" / ".env", override=True)
sys.path.insert(0, str(_ROOT / "backend"))

from supabase import create_client

from rag_ingest import create_or_update_url_source_and_ingest
from rag_topic_filters import (
    BABY_CHILDHOOD_EXCLUDE_RE as SKIP_RE,
    BABY_CHILDHOOD_INCLUDE_RE as TOPIC_RE,
    is_insp_baby_childhood_url,
)
from url_acquire import normalize_url

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
}

SOURCE_KEY = "insp-gov-ro"
HREF_RE = re.compile(r"""href=["']([^"']+)["']""", re.I)
TAG_RE = re.compile(r"<[^>]+>")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
POST_RE = re.compile(r"/20\d{2}/\d{2}/\d{2}/[^/?#]+", re.I)

KEEP_PATH_RE = re.compile(
    r"vaccin|copil|copii|sarcin|alapt|nou-?nasc|prematur|rujeol|rubeol|"
    r"oreion|pneumococ|hepatit|poliomiel|difter|tetanos|tuse.?convuls|"
    r"prenatal|pediatr|nutrit|adolescent|calendar.?national|"
    r"program.?national.?de.?vaccin|imuniz|gravid|BCG|DTPa|ROR|PNI|"
    r"recomandari.?pentru.?o.?sarcina|ghid.?de.?preventie|"
    r"consulta.?preventiv|travel.?advice|breastfeed|pregnan|infant|"
    r"child|vaccine|measles",
    re.I,
)

DROP_PATH_RE = re.compile(
    r"wp-admin|wp-login|feed/?$|xmlrpc|/tag/|/author/|/cart|/checkout|"
    r"cookie|privacy|gdpr|cariere|concurs|achiziti|"
    r"organigram|structura.?organizatorica|"
    r"\.(?:jpg|jpeg|png|gif|webp|svg|zip|css|js)(?:$|\?)",
    re.I,
)

DROP_TITLE_RE = re.compile(
    r"cariere|concurs|achizi[tț]|licita[tț]|organigram|"
    r"cookie|privacy|gdpr",
    re.I,
)

# High-signal hubs + known childhood / pregnancy articles and calendars
PRIORITY_URLS = [
    "https://insp.gov.ro/centrul-national-de-supraveghere-si-control-al-bolilor-transmisibile-cnscbt/calendarul-national-de-vaccinare/",
    "https://insp.gov.ro/centrul-national-de-supraveghere-si-control-al-bolilor-transmisibile-cnscbt/vaccinare/",
    "https://insp.gov.ro/2022/08/22/insp-incurajeaza-vaccinarea-copiilor/",
    "https://insp.gov.ro/2024/04/01/luna-nationala-de-informare-despre-vaccinare/",
    "https://insp.gov.ro/2025/03/03/campanie-nationala-de-informare-educare-si-comunicare/",
    "https://insp.gov.ro/2025/04/15/informatii-despre-vaccinare/",
    "https://insp.gov.ro/2024/07/10/ghid-de-preventie-consultatia-preventiva-integrata-la-copil-si-adult/",
    "https://insp.gov.ro/2023/02/01/sanatatea-reproducerii-dreptul-si-responsabilitatea-ta/",
    "https://insp.gov.ro/2023/11/02/noiembrie-2023-campania-ce-cat-si-cum-mananca-un-copil-istet/",
    "https://insp.gov.ro/2025/07/18/studiul-calitativ-pentru-cresterea-ratei-de-vaccinare-a-copiilor-desfasurat-de-insp-si-oms/",
    "https://insp.gov.ro/en/2024/04/22/unwanted-pregnancies-in-teenagers-what-can-we-do/",
    "https://insp.gov.ro/en/2024/04/22/information-for-parents-about-unwanted-teenage-pregnancies/",
    "https://insp.gov.ro/en/home/travel-advice/",
    "https://insp.gov.ro/",
    # Official PDFs (calendars, PNI, pregnancy, measles leaflets)
    "https://insp.gov.ro/wp-content/uploads/2026/03/01_Calendar_National_Vaccinare.pdf",
    "https://insp.gov.ro/wp-content/uploads/2024/04/Calendar-National-VACCINARE-2024.pdf",
    "https://insp.gov.ro/wp-content/uploads/2024/04/PNI-1-1.pdf",
    "https://insp.gov.ro/wp-content/uploads/2022/11/Programul-national-de-vaccinare.pdf",
    "https://insp.gov.ro/wp-content/uploads/2024/07/RECOMANDARI-PENTRU-O-SARCINA-SANATOASA.pdf",
    "https://insp.gov.ro/wp-content/uploads/2026/03/06_Pliant_RUJEOLA.pdf",
    "https://insp.gov.ro/wp-content/uploads/2025/03/Pliant_Rujeola.pdf",
]

CATEGORY_SEEDS = [
    "https://insp.gov.ro/",
    "https://insp.gov.ro/centrul-national-de-supraveghere-si-control-al-bolilor-transmisibile-cnscbt/vaccinare/",
    "https://insp.gov.ro/centrul-national-de-supraveghere-si-control-al-bolilor-transmisibile-cnscbt/calendarul-national-de-vaccinare/",
    "https://insp.gov.ro/centrul-national-de-evaluare-si-promovare-a-starii-de-sanatate-cnepss/",
    "https://insp.gov.ro/en/home/",
]

SEARCH_QUERIES = [
    "vaccinare copii",
    "calendar national vaccinare",
    "program national vaccinare",
    "rujeola",
    "sarcina sanatoasa",
    "alaptare",
    "nou-nascut",
    "prematur",
    "nutritie copii",
    "HPV vaccinare",
    "consultatie preventiva copil",
]


def clean(v: str | None) -> str:
    return (v or "").strip().strip('"').strip("'")


def _safe(msg: object) -> str:
    """Windows consoles (cp1252) choke on Romanian diacritics — keep logs printable."""
    return str(msg).encode("ascii", "replace").decode("ascii")


def log(msg: object) -> None:
    print(_safe(msg))


def fetch(url: str, *, retries: int = 2) -> str:
    last_err: Exception | None = None
    for attempt in range(max(1, retries)):
        try:
            try:
                r = requests.get(url, headers=UA, timeout=25, allow_redirects=True)
            except requests.exceptions.SSLError:
                r = requests.get(
                    url, headers=UA, timeout=25, allow_redirects=True, verify=False
                )
            if r.status_code == 503 and attempt + 1 < retries:
                time.sleep(0.8 * (attempt + 1))
                continue
            r.raise_for_status()
            r.encoding = r.apparent_encoding or "utf-8"
            return r.text
        except Exception as e:
            last_err = e
            if attempt + 1 < retries:
                time.sleep(0.6 * (attempt + 1))
                continue
            raise
    raise last_err or RuntimeError(f"fetch failed: {url}")


def extract_links(html: str, base: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for href in HREF_RE.findall(html):
        full = urljoin(base, href).split("#")[0]
        if "insp.gov.ro" not in full:
            continue
        if SKIP_RE.search(full) or DROP_PATH_RE.search(full):
            continue
        try:
            n = normalize_url(full)
        except ValueError:
            continue
        if n in seen:
            continue
        seen.add(n)
        out.append(n)
    return out


def page_title(html: str) -> str:
    m = TITLE_RE.search(html or "")
    if not m:
        return ""
    return TAG_RE.sub("", m.group(1)).strip()


def is_candidate_url(url: str) -> bool:
    if "insp.gov.ro" not in url or SKIP_RE.search(url) or DROP_PATH_RE.search(url):
        return False
    path = urlparse(url).path.lower()
    if path.endswith(".pdf") and KEEP_PATH_RE.search(url):
        return True
    if KEEP_PATH_RE.search(url) or TOPIC_RE.search(url):
        return True
    return bool(POST_RE.search(url) and TOPIC_RE.search(url))


def crawl_priorities() -> set[str]:
    urls: set[str] = set()
    for raw in PRIORITY_URLS:
        try:
            urls.add(normalize_url(raw))
        except ValueError:
            continue
    return urls


def crawl_categories() -> set[str]:
    urls: set[str] = set()
    for seed in CATEGORY_SEEDS:
        try:
            html = fetch(seed)
        except Exception as e:
            log(f"catalog fail {seed}: {e}")
            continue
        found = extract_links(html, seed)
        log(f"catalog {seed[-70:]} links={len(found)}")
        for u in found:
            if is_candidate_url(u):
                urls.add(u)
        if is_candidate_url(seed):
            try:
                urls.add(normalize_url(seed))
            except ValueError:
                pass
        time.sleep(0.12)
    return urls


def crawl_search() -> set[str]:
    urls: set[str] = set()
    for q in SEARCH_QUERIES:
        page = f"https://insp.gov.ro/?s={quote(q)}"
        try:
            html = fetch(page)
        except Exception as e:
            log(f"search fail {q}: {e}")
            continue
        for u in extract_links(html, page):
            if is_candidate_url(u):
                urls.add(u)
        log(f"search {q!r}: total={len(urls)}")
        time.sleep(0.15)
    return urls


def resolve_relevant(urls: set[str], *, soft: bool = False) -> dict[str, str]:
    resolved: dict[str, str] = {}
    for url in sorted(urls):
        try:
            nurl = normalize_url(url)
        except ValueError:
            continue
        if DROP_PATH_RE.search(nurl) or SKIP_RE.search(nurl):
            continue
        path = urlparse(nurl).path.rstrip("/")
        is_pdf = path.lower().endswith(".pdf")
        is_post = bool(POST_RE.search(path))
        is_hub = bool(KEEP_PATH_RE.search(path) and not is_post and not is_pdf)
        if not (is_pdf or is_post or is_hub or KEEP_PATH_RE.search(nurl)):
            continue

        slug_title = path.rsplit("/", 1)[-1].replace("-", " ").replace("_", " ")

        if is_pdf:
            # Curated priority PDFs always keep; otherwise require topic tokens.
            in_priority = any(
                nurl.rstrip("/") == normalize_url(p).rstrip("/")
                for p in PRIORITY_URLS
                if p.lower().endswith(".pdf")
            )
            keep = in_priority or is_insp_baby_childhood_url(
                nurl, title=slug_title, snippet=slug_title
            ) or bool(KEEP_PATH_RE.search(nurl))
            if keep:
                resolved[nurl] = slug_title
                log(f"KEEP-PDF {slug_title[:55]!r} | {nurl}")
            else:
                log(f"drop-pdf {slug_title[:55]!r} | {nurl}")
            continue

        if soft:
            # Priority-only / flaky-site mode: trust URL tokens, skip live HTML fetch.
            if KEEP_PATH_RE.search(nurl) or TOPIC_RE.search(nurl):
                resolved[nurl] = slug_title or nurl
                log(f"KEEP-soft {_safe(resolved[nurl])[:55]!r} | {nurl}")
            continue

        try:
            html = fetch(nurl)
            title = page_title(html)
            if not title or title.lower().startswith("404"):
                log(f"404 {nurl}")
                continue
            if DROP_TITLE_RE.search(title):
                log(f"drop-noise {title[:55]!r} | {nurl}")
                continue
            keep = is_insp_baby_childhood_url(
                nurl, title=title, snippet=html[:12000]
            ) or bool(KEEP_PATH_RE.search(nurl))
            if keep:
                resolved[nurl] = title
                log(f"KEEP {title[:55]!r} | {nurl}")
            else:
                log(f"drop {title[:55]!r} | {nurl}")
        except Exception as e:
            # Still keep high-signal priority hubs if the live site is flaky (503).
            if KEEP_PATH_RE.search(nurl) or TOPIC_RE.search(nurl):
                resolved[nurl] = slug_title or nurl
                log(f"KEEP-soft {_safe(resolved[nurl])[:55]!r} | {nurl} ({e})")
            else:
                log(f"resolve fail {nurl}: {e}")
        time.sleep(0.1)
    return resolved


def discover_candidate_urls(*, skip_live_crawl: bool = False) -> dict[str, str]:
    log("=== priority INSP urls ===")
    urls = crawl_priorities()
    log(f"priority urls: {len(urls)}")
    if not skip_live_crawl:
        log("=== crawl INSP categories ===")
        try:
            urls |= crawl_categories()
        except Exception as e:
            log(f"categories aborted: {e}")
        log(f"after categories: {len(urls)}")
        log("=== crawl INSP search ===")
        try:
            urls |= crawl_search()
        except Exception as e:
            log(f"search aborted: {e}")
        log(f"combined urls: {len(urls)}")
    else:
        log("=== skip live crawl (priority-only mode) ===")
    log("=== resolve relevance ===")
    return resolve_relevant(urls, soft=skip_live_crawl)


def delete_irrelevant_insp(sb, keep_urls: set[str]) -> tuple[int, int]:
    rows = (
        sb.table("rag_sources")
        .select("id,title,origin,source_url,chunk_count")
        .eq("source_key", SOURCE_KEY)
        .limit(2000)
        .execute()
        .data
        or []
    )
    deleted_sources = 0
    deleted_chunks = 0
    for row in rows:
        try:
            origin = normalize_url(row.get("origin") or row.get("source_url") or "")
        except ValueError:
            origin = (row.get("origin") or row.get("source_url") or "").strip()
        title = row.get("title") or ""
        keep = origin in keep_urls or is_insp_baby_childhood_url(origin, title=title)
        if "insp.gov.ro" not in origin.lower():
            keep = False
        if keep and (DROP_PATH_RE.search(origin) or DROP_TITLE_RE.search(title)):
            keep = False
        if keep and not SKIP_RE.search(origin):
            continue
        sid = row["id"]
        sb.table("rag_chunks").delete().eq("source_id", sid).execute()
        deleted_chunks += int(row.get("chunk_count") or 0)
        sb.table("rag_sources").delete().eq("id", sid).execute()
        deleted_sources += 1
        log(f"delete {title[:50]} | {origin[:90]}")
    return deleted_sources, deleted_chunks


def ingest_candidates(sb, candidates: dict[str, str], *, max_ingest: int = 50) -> int:
    added = 0
    ordered = sorted(
        candidates.items(),
        key=lambda it: (
            0 if it[0].lower().endswith(".pdf") and "calendar" in it[0].lower() else 1,
            0 if "vaccin" in it[0].lower() or "vaccin" in (it[1] or "").lower() else 1,
            0 if POST_RE.search(it[0]) else 2,
            it[0],
        ),
    )
    for url, title in ordered:
        if added >= max_ingest:
            break
        try:
            result = create_or_update_url_source_and_ingest(
                sb,
                url=url,
                title=title or None,
                source_key=SOURCE_KEY,
                language="ro",
                replace_existing=True,
                sleep_seconds=0.05,
            )
            added += 1
            log(
                f"ingested {added}: {(result.get('source') or {}).get('title') or title} "
                f"chunks={result.get('chunk_count')}"
            )
        except Exception as e:
            log(f"ingest fail {url}: {e}")
        time.sleep(0.12)
    return added


def upsert_knowledge_source(sb) -> None:
    meta = {
        "discover": "crawl",
        "topic_filter": "baby_childhood",
        "topic_include_regex": TOPIC_RE.pattern,
        "topic_exclude_regex": SKIP_RE.pattern,
        "max_urls": 80,
        "seed": True,
    }
    base = "https://insp.gov.ro/"
    row = {
        "source_key": SOURCE_KEY,
        "name": "INSP (România)",
        "source_type": "website",
        "language": "ro",
        "base_url": base,
        "enabled": True,
        "metadata": meta,
    }
    try:
        existing = (
            sb.table("knowledge_sources")
            .select("source_key")
            .eq("source_key", SOURCE_KEY)
            .limit(1)
            .execute()
            .data
            or []
        )
        if existing:
            sb.table("knowledge_sources").update(
                {
                    "name": row["name"],
                    "base_url": base,
                    "language": "ro",
                    "enabled": True,
                    "metadata": meta,
                }
            ).eq("source_key", SOURCE_KEY).execute()
        else:
            sb.table("knowledge_sources").insert(row).execute()
        log("updated knowledge_sources for insp-gov-ro")
    except Exception as e:
        log(f"ks update fail: {e}")


def main() -> int:
    import argparse
    import urllib3

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    parser = argparse.ArgumentParser(description="Sync INSP childhood pages into RAG")
    parser.add_argument(
        "--priority-only",
        action="store_true",
        default=True,
        help="Skip live category/search crawl; ingest curated priority URLs (default)",
    )
    parser.add_argument(
        "--full-crawl",
        action="store_true",
        help="Also crawl INSP category hubs + search (use when the site is healthy)",
    )
    args = parser.parse_args()

    url = clean(os.getenv("SUPABASE_URL"))
    key = clean(os.getenv("SUPABASE_SERVICE_KEY"))
    if not url or not key:
        log("missing supabase credentials")
        return 2
    sb = create_client(url, key)

    log("=== discover insp baby/childhood urls ===")
    priority_only = not bool(args.full_crawl)
    if clean(os.getenv("INSP_PRIORITY_ONLY")).lower() in ("0", "false", "no"):
        priority_only = False
    candidates = discover_candidate_urls(skip_live_crawl=priority_only)
    log(f"candidates: {len(candidates)}")
    for u, t in list(candidates.items())[:60]:
        log(f"  - {(t or '')[:50]} | {u}")

    log("=== delete irrelevant insp ===")
    deleted_s, deleted_c = delete_irrelevant_insp(sb, set(candidates.keys()))
    log(f"deleted sources={deleted_s} approx_chunks={deleted_c}")

    log("=== ingest relevant insp ===")
    added = ingest_candidates(sb, candidates, max_ingest=50)
    log(f"ingested/updated: {added}")

    upsert_knowledge_source(sb)

    srcs = (
        sb.table("rag_sources")
        .select("id,title,origin,chunk_count,status")
        .eq("source_key", SOURCE_KEY)
        .eq("status", "ready")
        .limit(500)
        .execute()
        .data
        or []
    )
    log(
        f"READY insp sources: {len(srcs)} "
        f"chunks={sum(int(s.get('chunk_count') or 0) for s in srcs)}"
    )
    for s in srcs[:50]:
        log(
            f"  {int(s.get('chunk_count') or 0):3d} "
            f"{(s.get('title') or '')[:55]} | {(s.get('origin') or '')[:80]}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
