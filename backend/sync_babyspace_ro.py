"""Discover Babyspace Romania (babyspace.com.ro) articles and sync into RAG."""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse

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
    is_babyspace_ro_url,
)
from url_acquire import normalize_url

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ro-RO,ro;q=0.9,en;q=0.7",
}

SOURCE_KEY = "babyspace-ro"
HREF_RE = re.compile(r"""href=["']([^"']+)["']""", re.I)
TAG_RE = re.compile(r"<[^>]+>")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)

DROP_PATH_RE = re.compile(
    r"/e-shop|/conecteaza|/inscrie|/termeni|/cookie|/protectia-datelor|"
    r"/users/|/banners/|/tags/|"
    r"\.(?:jpg|jpeg|png|gif|webp|svg|zip|css|js)(?:$|\?)",
    re.I,
)

PRIORITY_URLS = [
    "https://www.babyspace.com.ro/ro/al%C4%83ptarea-%C8%99i-diversificarea",
    "https://www.babyspace.com.ro/ro/urm%C4%83rirea-medical%C4%83-prenatal%C4%83",
    "https://www.babyspace.com.ro/ro/10-alimente-pe-care-este-indicat-s%C4%83-le-consumi-%C3%AEn-timpul-sarcinii",
    "https://www.babyspace.com.ro/ro/ce-trebuie-s%C4%83-%C8%99tii-despre-colici",
    "https://www.babyspace.com.ro/ro/febra",
    "https://www.babyspace.com.ro/ro/sfaturi-pentru-un-nou-n%C4%83scut-s%C4%83n%C4%83tos",
    "https://www.babyspace.com.ro/ro/5-sfaturi-practice-pentru-noile-m%C4%83mici",
    "https://www.babyspace.com.ro/ro/34721-sarcina",
]

CATEGORY_SEEDS = [
    "https://www.babyspace.com.ro/ro",
    "https://www.babyspace.com.ro/ro/34721-sarcina",
    "https://www.babyspace.com.ro/ro/bebelusul",
    "https://www.babyspace.com.ro/ro/copilul-de-1-3-ani",
    "https://www.babyspace.com.ro/ro/copilul",
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
        if "babyspace.com.ro" not in full:
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
    if not is_babyspace_ro_url(url):
        return False
    if DROP_PATH_RE.search(url):
        return False
    path = urlparse(url).path.rstrip("/")
    # Prefer article-like paths (slug length), skip bare section homes if thin
    slug = path.rsplit("/", 1)[-1]
    if slug in ("ro", ""):
        return False
    return True


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
        log(f"catalog {seed[-60:]} links={len(found)}")
        for u in found:
            if is_candidate_url(u):
                urls.add(u)
        time.sleep(0.15)
    return urls


def resolve_relevant(urls: set[str], *, soft: bool = False) -> dict[str, str]:
    resolved: dict[str, str] = {}
    for url in sorted(urls):
        try:
            nurl = normalize_url(url)
        except ValueError:
            continue
        if DROP_PATH_RE.search(nurl) or not is_babyspace_ro_url(nurl):
            continue
        path = urlparse(nurl).path.rstrip("/")
        slug = unquote(path.rsplit("/", 1)[-1]).replace("-", " ")
        if soft:
            resolved[nurl] = slug or nurl
            log(f"KEEP-soft {_safe(resolved[nurl])[:55]!r} | {nurl}")
            continue
        try:
            html = fetch(nurl)
            title = page_title(html)
            if not title or "404" in title.lower():
                log(f"404 {nurl}")
                continue
            if len(html) < 800:
                log(f"drop-thin {title[:40]!r} | {nurl}")
                continue
            resolved[nurl] = title
            log(f"KEEP {title[:55]!r} | {nurl}")
        except Exception as e:
            resolved[nurl] = slug or nurl
            log(f"KEEP-soft {_safe(resolved[nurl])[:55]!r} | {nurl} ({e})")
        time.sleep(0.08)
    return resolved


def discover_candidate_urls(*, skip_live_crawl: bool = False) -> dict[str, str]:
    log("=== priority Babyspace RO urls ===")
    urls = crawl_priorities()
    log(f"priority urls: {len(urls)}")
    if not skip_live_crawl:
        log("=== crawl Babyspace RO categories ===")
        try:
            urls |= crawl_categories()
        except Exception as e:
            log(f"categories aborted: {e}")
        log(f"combined urls: {len(urls)}")
    else:
        log("=== skip live crawl (priority-only mode) ===")
    log("=== resolve relevance ===")
    return resolve_relevant(urls, soft=skip_live_crawl)


def ingest_candidates(sb, candidates: dict[str, str], *, max_ingest: int = 40) -> int:
    added = 0
    ordered = sorted(
        candidates.items(),
        key=lambda it: (
            0
            if any(
                x in it[0].lower()
                for x in ("alapt", "sarcin", "prenatal", "bebel", "diversif", "colic", "febr")
            )
            else 1,
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
        time.sleep(0.1)
    return added


def upsert_knowledge_source(sb) -> None:
    meta = {
        "discover": "crawl",
        "topic_filter": "baby_childhood",
        "max_urls": 120,
        "seed": True,
    }
    base = "https://www.babyspace.com.ro/ro"
    row = {
        "source_key": SOURCE_KEY,
        "name": "Babyspace România",
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
        log("updated knowledge_sources for babyspace-ro")
    except Exception as e:
        log(f"ks update fail: {e}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Babyspace RO into RAG")
    parser.add_argument("--full-crawl", action="store_true")
    args = parser.parse_args()

    url = clean(os.getenv("SUPABASE_URL"))
    key = clean(os.getenv("SUPABASE_SERVICE_KEY"))
    if not url or not key:
        log("missing supabase credentials")
        return 2
    sb = create_client(url, key)

    priority_only = not bool(args.full_crawl)
    candidates = discover_candidate_urls(skip_live_crawl=priority_only)
    log(f"candidates: {len(candidates)}")
    added = ingest_candidates(sb, candidates, max_ingest=40)
    log(f"ingested/updated: {added}")
    upsert_knowledge_source(sb)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
