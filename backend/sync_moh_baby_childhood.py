"""Discover MOH (moh.gov.gr) pages related to babies / childhood and sync into RAG."""
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
    is_moh_baby_childhood_url,
)
from url_acquire import normalize_url

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

SOURCE_KEY = "moh-gov-gr"
HREF_RE = re.compile(r"""href=["']([^"']+)["']""", re.I)
TAG_RE = re.compile(r"<[^>]+>")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
ARTICLE_RE = re.compile(r"/articles/.+/\d{3,}-", re.I)

# High-signal MOH sections for childhood / vaccines / maternity-adjacent public health
KEEP_PATH_RE = re.compile(
    r"emboliasmoi|epe-paidiwn|paidiwn-kai-efhbwn|bref|paid|egkym|kyis|"
    r"diatrofh-paidiwn|sxolik|kylike|nirsevimab|rsv|pcv20|rotaio|"
    r"mhniggitidokokko|thhlwmatwn|hpv|agwgh-ygeias|"
    r"proagwgh-psyxikhs-ygeias-paidioy|programma-prolhpshs.*paidiwn|"
    r"parembash-pleiades|antigripikos-emboliasmos|epoxikh-griph|"
    r"alles-systaseis|ethnikh-epitroph-emboliasmwn",
    re.I,
)

DROP_PATH_RE = re.compile(
    r"emboliasmoi-covid-19/\d|epe-enhlikwn|noshleytik|ekpaideytika-kentra|"
    r"eidikothtes|ekseidikeyseis|tameioy-anakampshs|tempwn|"
    r"anoia|medwatch|synenteyksh-typoy|dhlwsh-ypoyrgoy|"
    r"ethniko-shmeio-epafhs|enhmerwtikes-ekpaideytikes|"
    r"seyyp|prokhryk|promhthe|proslhps",
    re.I,
)

DROP_TITLE_RE = re.compile(
    r"κικίλιας|δήλωση υπουργού|συνέντευξη τύπου|άδωνι|"
    r"νοσηλευτικ|εκπαιδευτικά κέντρα|ειδικότητες|"
    r"ταμείου ανάκαμψης|άνοια|medwatch",
    re.I,
)

CATEGORY_SEEDS = [
    "https://www.moh.gov.gr/articles/health/dieythynsh-dhmosias-ygieinhs/emboliasmoi",
    (
        "https://www.moh.gov.gr/articles/health/dieythynsh-dhmosias-ygieinhs/"
        "emboliasmoi/ethniko-programma-emboliasmwn-epe-paidiwn-kai-efhbwn"
    ),
    (
        "https://www.moh.gov.gr/articles/health/dieythynsh-dhmosias-ygieinhs/"
        "emboliasmoi/ethnikh-epitroph-emboliasmwn"
    ),
    (
        "https://www.moh.gov.gr/articles/health/dieythynsh-dhmosias-ygieinhs/"
        "emboliasmoi/alles-systaseis-ths-ethnikhs-epitrophs-emboliasmwn"
    ),
    (
        "https://www.moh.gov.gr/articles/health/dieythynsh-dhmosias-ygieinhs/"
        "metadotika-kai-mh-metadotika-noshmata/c388-egkyklioi"
    ),
    (
        "https://www.moh.gov.gr/articles/health/dieythynsh-prwtobathmias-frontidas-ygeias/"
        "draseis-kai-programmata-agwghs-ygeias"
    ),
]

SEARCH_QUERIES = [
    "Εθνικό Πρόγραμμα Εμβολιασμών παιδιών",
    "διατροφή παιδιών βρεφονηπιακούς",
    "σχολικά κυλικεία",
    "RSV βρέφη",
    "nirsevimab",
    "εμβόλιο ροταϊού",
    "μηνιγγιτιδόκοκκος βρέφη",
    "HPV εμβόλιο",
    "αντιγριπικός εμβολιασμός",
    "θηλασμός",
    "εγκυμοσύνη",
]


def clean(v: str | None) -> str:
    return (v or "").strip().strip('"').strip("'")


def fetch(url: str) -> str:
    r = requests.get(url, headers=UA, timeout=40, allow_redirects=True)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def extract_links(html: str, base: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for href in HREF_RE.findall(html):
        full = urljoin(base, href).split("#")[0]
        if "moh.gov.gr" not in full:
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
    if "moh.gov.gr" not in url or SKIP_RE.search(url) or DROP_PATH_RE.search(url):
        return False
    if KEEP_PATH_RE.search(url) or TOPIC_RE.search(url):
        return True
    return bool(ARTICLE_RE.search(url) and TOPIC_RE.search(url))


def crawl_categories() -> set[str]:
    urls: set[str] = set()
    for seed in CATEGORY_SEEDS:
        for start in range(0, 120, 10):
            page = seed if start == 0 else f"{seed}?start={start}"
            try:
                html = fetch(page)
            except Exception as e:
                print(f"catalog fail {page}: {e}")
                break
            found = extract_links(html, page)
            articles = [u for u in found if ARTICLE_RE.search(u) or KEEP_PATH_RE.search(u)]
            print(f"catalog {page[-70:]} articles={len(articles)}")
            if start > 0 and not articles:
                break
            for u in found:
                if is_candidate_url(u):
                    urls.add(u)
            # Always keep the seed section itself if topical
            if is_candidate_url(seed):
                urls.add(normalize_url(seed))
            time.sleep(0.12)
    return urls


def crawl_search() -> set[str]:
    urls: set[str] = set()
    for q in SEARCH_QUERIES:
        for tmpl in (
            "https://www.moh.gov.gr/?s={q}",
            "https://www.moh.gov.gr/component/search/?searchword={q}&searchphrase=all",
        ):
            page = tmpl.format(q=quote(q))
            try:
                html = fetch(page)
            except Exception as e:
                print(f"search fail {q}: {e}")
                continue
            for u in extract_links(html, page):
                if is_candidate_url(u):
                    urls.add(u)
            print(f"search {q!r}: total={len(urls)}")
            time.sleep(0.12)
    return urls


def resolve_relevant(urls: set[str]) -> dict[str, str]:
    resolved: dict[str, str] = {}
    for url in sorted(urls):
        try:
            nurl = normalize_url(url)
        except ValueError:
            continue
        if DROP_PATH_RE.search(nurl) or SKIP_RE.search(nurl):
            continue
        # Skip pagination hubs
        if "?start=" in nurl and not ARTICLE_RE.search(nurl):
            continue
        path = urlparse(nurl).path.rstrip("/")
        # Prefer article pages and key section hubs (vaccine program)
        is_hub = bool(
            KEEP_PATH_RE.search(path)
            and not ARTICLE_RE.search(path)
            and path.count("/") >= 4
        )
        is_article = bool(ARTICLE_RE.search(path))
        if not is_hub and not is_article:
            continue
        try:
            html = fetch(nurl)
            title = page_title(html)
            if not title or title.lower().startswith("404"):
                print(f"404 {nurl}")
                continue
            if DROP_TITLE_RE.search(title):
                print(f"drop-noise {title[:55]!r} | {nurl}")
                continue
            # Skip adult-only vaccine program
            if "epe-enhlikwn" in nurl or "ενηλίκων" in title.lower():
                print(f"drop-adult {title[:55]!r} | {nurl}")
                continue
            keep = is_moh_baby_childhood_url(
                nurl, title=title, snippet=html[:10000]
            ) or bool(KEEP_PATH_RE.search(nurl))
            if keep:
                resolved[nurl] = title
                print(f"KEEP {title[:55]!r} | {nurl}")
            else:
                print(f"drop {title[:55]!r} | {nurl}")
        except Exception as e:
            print(f"resolve fail {nurl}: {e}")
        time.sleep(0.1)
    return resolved


def discover_candidate_urls() -> dict[str, str]:
    print("=== crawl MOH categories ===")
    urls = crawl_categories()
    print(f"category urls: {len(urls)}")
    print("=== crawl MOH search ===")
    urls |= crawl_search()
    print(f"combined urls: {len(urls)}")
    print("=== resolve relevance ===")
    return resolve_relevant(urls)


def delete_irrelevant_moh(sb, keep_urls: set[str]) -> tuple[int, int]:
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
        keep = origin in keep_urls or is_moh_baby_childhood_url(origin, title=title)
        if "moh.gov.gr" not in origin.lower():
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
        print(f"delete {title[:50]} | {origin[:90]}")
    return deleted_sources, deleted_chunks


def ingest_candidates(sb, candidates: dict[str, str], *, max_ingest: int = 45) -> int:
    added = 0
    ordered = sorted(
        candidates.items(),
        key=lambda it: (
            0 if "epe-paidiwn" in it[0] or "paidiwn-kai-efhbwn" in it[0] else 1,
            0 if "emboliasmoi" in it[0] else 1,
            0 if ARTICLE_RE.search(it[0]) else 2,
            # Prefer newer article ids (higher numbers) roughly
            -(int(m.group(1)) if (m := re.search(r"/(\d{4,})-", it[0])) else 0),
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
                language="el",
                replace_existing=True,
                sleep_seconds=0.05,
            )
            added += 1
            print(
                f"ingested {added}: {(result.get('source') or {}).get('title') or title} "
                f"chunks={result.get('chunk_count')}"
            )
        except Exception as e:
            print(f"ingest fail {url}: {e}")
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
    base = (
        "https://www.moh.gov.gr/articles/health/dieythynsh-dhmosias-ygieinhs/"
        "emboliasmoi/ethniko-programma-emboliasmwn-epe-paidiwn-kai-efhbwn"
    )
    row = {
        "source_key": SOURCE_KEY,
        "name": "Υπουργείο Υγείας (MOH)",
        "source_type": "website",
        "language": "el",
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
                    "enabled": True,
                    "metadata": meta,
                }
            ).eq("source_key", SOURCE_KEY).execute()
        else:
            sb.table("knowledge_sources").insert(row).execute()
        print("updated knowledge_sources for moh-gov-gr")
    except Exception as e:
        print(f"ks update fail: {e}")


def main() -> int:
    url = clean(os.getenv("SUPABASE_URL"))
    key = clean(os.getenv("SUPABASE_SERVICE_KEY"))
    if not url or not key:
        print("missing supabase credentials")
        return 2
    sb = create_client(url, key)

    print("=== discover moh baby/childhood urls ===")
    candidates = discover_candidate_urls()
    print(f"candidates: {len(candidates)}")
    for u, t in list(candidates.items())[:60]:
        print(f"  - {(t or '')[:50]} | {u}")

    print("=== delete irrelevant moh ===")
    deleted_s, deleted_c = delete_irrelevant_moh(sb, set(candidates.keys()))
    print(f"deleted sources={deleted_s} approx_chunks={deleted_c}")

    print("=== ingest relevant moh ===")
    added = ingest_candidates(sb, candidates, max_ingest=45)
    print(f"ingested/updated: {added}")

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
    print(
        f"READY moh sources: {len(srcs)} "
        f"chunks={sum(int(s.get('chunk_count') or 0) for s in srcs)}"
    )
    for s in srcs[:50]:
        print(
            f"  {int(s.get('chunk_count') or 0):3d} "
            f"{(s.get('title') or '')[:55]} | {(s.get('origin') or '')[:80]}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
