"""Discover WHO (who.int) pages related to babies / childhood and sync into RAG."""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

import requests
import urllib3
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
    is_who_baby_childhood_url,
)
from url_acquire import normalize_url

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

SOURCE_KEY = "who-int"
HREF_RE = re.compile(r"""href=["']([^"']+)["']""", re.I)
TAG_RE = re.compile(r"<[^>]+>")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)

KEEP_PATH_RE = re.compile(
    r"infant|young.?child|breastfeed|newborn|preterm|pregnan|maternal|"
    r"immunization|vaccin|measles|pertussis|polio|hepatitis.?b|rubella|"
    r"pneumonia|diarrhoea|diarrhea|complementary.?feeding|kangaroo|"
    r"child.?health|adolescent.?health|congenital|birth.?weight|"
    r"routine.?immunization|fact-sheets/detail/",
    re.I,
)

DROP_PATH_RE = re.compile(
    r"/careers|/employment|/procurement|/donate|/shop|"
    r"/about/who-we-are|/governance|/ethics|"
    r"\.(?:jpg|jpeg|png|gif|webp|svg|zip|css|js)(?:$|\?)",
    re.I,
)

PRIORITY_URLS = [
    "https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding",
    "https://www.who.int/news-room/fact-sheets/detail/newborn-mortality",
    "https://www.who.int/news-room/fact-sheets/detail/preterm-birth",
    "https://www.who.int/news-room/fact-sheets/detail/measles",
    "https://www.who.int/news-room/fact-sheets/detail/immunization-coverage",
    "https://www.who.int/news-room/fact-sheets/detail/breastfeeding",
    "https://www.who.int/news-room/fact-sheets/detail/pneumonia",
    "https://www.who.int/news-room/fact-sheets/detail/diarrhoeal-disease",
    "https://www.who.int/news-room/fact-sheets/detail/hepatitis-b",
    "https://www.who.int/news-room/fact-sheets/detail/poliomyelitis",
    "https://www.who.int/news-room/fact-sheets/detail/rubella",
    "https://www.who.int/news-room/fact-sheets/detail/pertussis",
    "https://www.who.int/news-room/questions-and-answers/item/breastfeeding",
    "https://www.who.int/docs/default-source/immunization/tables/immunization-routine-table2.pdf",
    (
        "https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing/"
        "handbooks/programme-manager-s-handbook-mncah/"
        "recommendations-on-interventions-along-life-course/newborn"
    ),
]

CATEGORY_SEEDS = [
    "https://www.who.int/news-room/fact-sheets",
    "https://www.who.int/health-topics/breastfeeding",
    "https://www.who.int/health-topics/infant-nutrition",
    "https://www.who.int/health-topics/immunization",
    "https://www.who.int/health-topics/newborn-health",
    "https://www.who.int/teams/maternal-newborn-child-adolescent-health-and-ageing",
]

SEARCH_QUERIES = [
    "infant and young child feeding",
    "breastfeeding exclusive",
    "newborn care",
    "preterm birth",
    "measles vaccination children",
    "routine immunization children",
    "hepatitis B newborn",
    "pertussis pregnancy",
]


def clean(v: str | None) -> str:
    return (v or "").strip().strip('"').strip("'")


def _safe(msg: object) -> str:
    return str(msg).encode("ascii", "replace").decode("ascii")


def log(msg: object) -> None:
    print(_safe(msg), flush=True)


def fetch(url: str, *, retries: int = 2) -> str:
    last_err: Exception | None = None
    for attempt in range(max(1, retries)):
        try:
            try:
                r = requests.get(url, headers=UA, timeout=30, allow_redirects=True)
            except requests.exceptions.SSLError:
                r = requests.get(
                    url, headers=UA, timeout=30, allow_redirects=True, verify=False
                )
            if r.status_code in (429, 503) and attempt + 1 < retries:
                time.sleep(1.0 * (attempt + 1))
                continue
            r.raise_for_status()
            r.encoding = r.apparent_encoding or "utf-8"
            return r.text
        except Exception as e:
            last_err = e
            if attempt + 1 < retries:
                time.sleep(0.8 * (attempt + 1))
                continue
            raise
    raise last_err or RuntimeError(f"fetch failed: {url}")


def extract_links(html: str, base: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for href in HREF_RE.findall(html):
        full = urljoin(base, href).split("#")[0].split("?")[0]
        if "who.int" not in full:
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
    if "who.int" not in url or SKIP_RE.search(url) or DROP_PATH_RE.search(url):
        return False
    path = urlparse(url).path.lower()
    if path.endswith(".pdf") and KEEP_PATH_RE.search(url):
        return True
    return bool(KEEP_PATH_RE.search(url) or TOPIC_RE.search(url))


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
        time.sleep(0.15)
    return urls


def crawl_search() -> set[str]:
    urls: set[str] = set()
    for q in SEARCH_QUERIES:
        page = f"https://www.who.int/home/search-results?indexCatalogue=genericsearchindex1&searchQuery={quote(q)}"
        try:
            html = fetch(page)
        except Exception as e:
            log(f"search fail {q}: {e}")
            continue
        for u in extract_links(html, page):
            if is_candidate_url(u):
                urls.add(u)
        log(f"search {q!r}: total={len(urls)}")
        time.sleep(0.2)
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
        slug_title = path.rsplit("/", 1)[-1].replace("-", " ").replace("_", " ")

        if is_pdf:
            in_priority = any(
                nurl.rstrip("/") == normalize_url(p).rstrip("/")
                for p in PRIORITY_URLS
                if p.lower().endswith(".pdf")
            )
            keep = (
                in_priority
                or is_who_baby_childhood_url(nurl, title=slug_title, snippet=slug_title)
                or bool(KEEP_PATH_RE.search(nurl))
            )
            if keep:
                resolved[nurl] = slug_title
                log(f"KEEP-PDF {slug_title[:55]!r} | {nurl}")
            else:
                log(f"drop-pdf {slug_title[:55]!r} | {nurl}")
            continue

        if soft:
            if KEEP_PATH_RE.search(nurl) or TOPIC_RE.search(nurl):
                resolved[nurl] = slug_title or nurl
                log(f"KEEP-soft {_safe(resolved[nurl])[:55]!r} | {nurl}")
            continue

        try:
            html = fetch(nurl)
            title = page_title(html)
            if not title or "404" in title.lower() or "not found" in title.lower():
                log(f"404 {nurl}")
                continue
            keep = is_who_baby_childhood_url(
                nurl, title=title, snippet=html[:12000]
            ) or bool(KEEP_PATH_RE.search(nurl))
            if keep:
                resolved[nurl] = title
                log(f"KEEP {title[:55]!r} | {nurl}")
            else:
                log(f"drop {title[:55]!r} | {nurl}")
        except Exception as e:
            if KEEP_PATH_RE.search(nurl) or TOPIC_RE.search(nurl):
                resolved[nurl] = slug_title or nurl
                log(f"KEEP-soft {_safe(resolved[nurl])[:55]!r} | {nurl} ({e})")
            else:
                log(f"resolve fail {nurl}: {e}")
        time.sleep(0.1)
    return resolved


def discover_candidate_urls(*, skip_live_crawl: bool = False) -> dict[str, str]:
    log("=== priority WHO urls ===")
    urls = crawl_priorities()
    log(f"priority urls: {len(urls)}")
    if not skip_live_crawl:
        log("=== crawl WHO categories ===")
        try:
            urls |= crawl_categories()
        except Exception as e:
            log(f"categories aborted: {e}")
        log(f"after categories: {len(urls)}")
        log("=== crawl WHO search ===")
        try:
            urls |= crawl_search()
        except Exception as e:
            log(f"search aborted: {e}")
        log(f"combined urls: {len(urls)}")
    else:
        log("=== skip live crawl (priority-only mode) ===")
    log("=== resolve relevance ===")
    return resolve_relevant(urls, soft=skip_live_crawl)


def delete_irrelevant_who(sb, keep_urls: set[str]) -> tuple[int, int]:
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
        keep = origin in keep_urls or is_who_baby_childhood_url(origin, title=title)
        if "who.int" not in origin.lower():
            keep = False
        if keep and DROP_PATH_RE.search(origin):
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
            0 if "fact-sheets/detail" in it[0] else 1,
            0 if it[0].lower().endswith(".pdf") else 1,
            0 if "immunization" in it[0].lower() or "vaccin" in it[0].lower() else 1,
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
                language="en",
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
    base = (
        "https://www.who.int/news-room/fact-sheets/detail/"
        "infant-and-young-child-feeding"
    )
    row = {
        "source_key": SOURCE_KEY,
        "name": "WHO",
        "source_type": "website",
        "language": "en",
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
                    "language": "en",
                    "enabled": True,
                    "metadata": meta,
                }
            ).eq("source_key", SOURCE_KEY).execute()
        else:
            sb.table("knowledge_sources").insert(row).execute()
        log("updated knowledge_sources for who-int")
    except Exception as e:
        log(f"ks update fail: {e}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync WHO childhood pages into RAG")
    parser.add_argument(
        "--full-crawl",
        action="store_true",
        help="Also crawl WHO hubs + search (when the site is healthy)",
    )
    args = parser.parse_args()

    url = clean(os.getenv("SUPABASE_URL"))
    key = clean(os.getenv("SUPABASE_SERVICE_KEY"))
    if not url or not key:
        log("missing supabase credentials")
        return 2
    sb = create_client(url, key)

    log("=== discover who baby/childhood urls ===")
    priority_only = not bool(args.full_crawl)
    candidates = discover_candidate_urls(skip_live_crawl=priority_only)
    log(f"candidates: {len(candidates)}")
    for u, t in list(candidates.items())[:60]:
        log(f"  - {(t or '')[:50]} | {u}")

    log("=== delete irrelevant who ===")
    deleted_s, deleted_c = delete_irrelevant_who(sb, set(candidates.keys()))
    log(f"deleted sources={deleted_s} approx_chunks={deleted_c}")

    log("=== ingest relevant who ===")
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
        f"READY who sources: {len(srcs)} "
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
