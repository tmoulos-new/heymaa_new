"""Discover EODY pages related to babies / childhood and sync into RAG."""
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
    EODY_BABY_CHILDHOOD_EXCLUDE_RE as SKIP_RE,
    EODY_BABY_CHILDHOOD_INCLUDE_RE as TOPIC_RE,
    is_eody_baby_childhood_url,
)
from url_acquire import normalize_url

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

SOURCE_KEY = "eody-gov-gr"
HREF_RE = re.compile(r"""href=["']([^"']+)["']""", re.I)
TAG_RE = re.compile(r"<[^>]+>")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)

# Pediatric / vaccine-relevant disease slugs (not the whole catalog)
DISEASE_KEEP_RE = re.compile(
    r"anemevlog|ilara|measles|kokkyt|pertuss|parotit|mumps|erythr|rubella|"
    r"rota[iïy]|miniggit|meningit|poliomyel|difther|tetan|aimofil|hib|"
    r"pneumoniok|pnevmoniok|hpv|ipatitida-v|hepatitis.?b|"
    r"gript|influenza|ostrok|scarlet|scarlat|parvovir|"
    r"koxsack|coxsack|strepto.?omadas|"
    r"varicella|chickenpox|whooping|diphther|polio|"
    r"neogn|neonat|bref|paid|egkym|kyis|thilas|emvol|"
    r"listeri|toksoplasm|sifil|syggen|"
    r"brefonipiak|sxolik|νηπιαγ|βρεφονηπ|εμβολιασ|"
    r"emboliasmoi|proagoge-ygeias-se-brefonipiak|"
    r"metra-prolipsis.*brefonipiak|metra-prolipsis.*sxolik",
    re.I,
)

# Press/org noise even if a keyword appears in the URL slug
DROP_TITLE_RE = re.compile(
    r"συνάντηση του προέδρου|διαπιστευμένων συντακτών|κικίλιας|"
    r"υφυπουργό πολιτικής προστασίας|chardalia|"
    r"ερυθρού σταυρού|red.?cross",
    re.I,
)

SEARCH_QUERIES = [
    "ιλαρά",
    "κοκκύτης",
    "ανεμευλογιά",
    "μηνιγγίτιδα",
    "εμβολιασμός παιδιών",
    "εθνικό πρόγραμμα εμβολιασμών",
    "βρέφος",
    "νεογνό",
    "εγκυμοσύνη",
    "θηλασμός",
    "ροταϊός",
    "RSV",
    "πνευμονιόκοκκος",
    "ηπατίτιδα Β",
    "πολιομυελίτιδα",
    "διφθερίτιδα",
    "τέτανος",
    "παρωτίτιδα",
    "ερυθρά",
    "λιστέρια εγκυμοσύνη",
]


def clean(v: str | None) -> str:
    return (v or "").strip().strip('"').strip("'")


def fetch(url: str) -> str:
    r = requests.get(url, headers=UA, timeout=35, allow_redirects=True)
    r.raise_for_status()
    return r.text


def extract_links(html: str, base: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for href in HREF_RE.findall(html):
        full = urljoin(base, href).split("#")[0].split("?")[0]
        if "eody.gov.gr" not in full:
            continue
        if SKIP_RE.search(full):
            continue
        if "/search.html" in full or "format=feed" in full or ".feed" in full:
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
    if SKIP_RE.search(url) or "eody.gov.gr" not in url:
        return False
    path = urlparse(url).path.lower()
    if path.endswith((".pdf", ".jpg", ".png", ".gif", ".zip", ".css", ".js")):
        return False
    if any(
        x in path
        for x in (
            "alfavitiko",
            "organismos",
            "prokirykseis",
            "diktyo-ergastirion",
            "prosopika-dedomena",
            "cookie",
        )
    ):
        return False
    # Explicit pediatric / vaccine disease pages
    if DISEASE_KEEP_RE.search(url) or TOPIC_RE.search(url):
        return True
    # Disease detail pages: keep in candidate pool; resolve() decides
    if "/nosimata-kai-themata-ygeias/" in path and path.count("/") >= 5:
        return True
    return False


def crawl_disease_catalog() -> set[str]:
    """Paginate Νοσήματα και θέματα υγείας and collect article links."""
    base = "https://eody.gov.gr/el/nosimata/metadotika/nosimata-kai-themata-ygeias.html"
    urls: set[str] = set()
    for start in range(0, 200, 9):
        page = base if start == 0 else f"{base}?start={start}"
        try:
            html = fetch(page)
        except Exception as e:
            print(f"catalog fail {page}: {e}")
            break
        links = extract_links(html, page)
        page_articles = [
            u
            for u in links
            if "/nosimata-kai-themata-ygeias/" in u
            and not u.rstrip("/").endswith("nosimata-kai-themata-ygeias")
        ]
        print(f"catalog start={start} articles={len(page_articles)}")
        if not page_articles and start > 0:
            break
        urls.update(page_articles)
        for u in links:
            if is_candidate_url(u):
                urls.add(u)
        time.sleep(0.12)
    return urls


def crawl_search_hits() -> set[str]:
    urls: set[str] = set()
    for q in SEARCH_QUERIES:
        page = f"https://eody.gov.gr/search.html?q={quote(q)}"
        try:
            html = fetch(page)
        except Exception as e:
            print(f"search fail {q}: {e}")
            continue
        for u in extract_links(html, page):
            if is_candidate_url(u):
                urls.add(u)
        print(f"search {q!r}: +candidates total={len(urls)}")
        time.sleep(0.15)
    return urls


def resolve_relevant(urls: set[str]) -> dict[str, str]:
    """Fetch each URL and keep only baby/childhood/vaccine-relevant pages."""
    resolved: dict[str, str] = {}
    for url in sorted(urls):
        try:
            nurl = normalize_url(url)
        except ValueError:
            continue
        path = urlparse(nurl).path.rstrip("/")
        if path.endswith("nosimata-kai-themata-ygeias") or path.endswith("metadotika"):
            continue
        slug_hit = bool(DISEASE_KEEP_RE.search(nurl))
        try:
            html = fetch(nurl)
            title = page_title(html)
            if title.startswith("404"):
                print(f"404 {nurl}")
                continue
            if DROP_TITLE_RE.search(title) or DROP_TITLE_RE.search(nurl):
                print(f"drop-noise {title[:55]!r} | {nurl}")
                continue
            snippet = html[:12000]
            topic_hit = is_eody_baby_childhood_url(nurl, title=title, snippet=snippet)
            body_disease = bool(DISEASE_KEEP_RE.search(f"{title} {snippet}"))
            # Catalog disease pages: require pediatric slug OR clear topic in title/body
            if "/nosimata-kai-themata-ygeias/" in nurl:
                keep = slug_hit or topic_hit
            else:
                # News / guides: require topic in title/url/body (not just weak slug)
                keep = topic_hit or (slug_hit and body_disease)
            if keep and not SKIP_RE.search(nurl):
                resolved[nurl] = title
                print(f"KEEP {title[:55]!r} | {nurl}")
            else:
                print(f"drop {title[:55]!r} | {nurl}")
        except Exception as e:
            print(f"resolve fail {nurl}: {e}")
        time.sleep(0.1)
    return resolved


def discover_candidate_urls() -> dict[str, str]:
    print("=== crawl disease catalog ===")
    urls = crawl_disease_catalog()
    print(f"catalog urls: {len(urls)}")
    print("=== crawl search ===")
    urls |= crawl_search_hits()
    print(f"combined urls: {len(urls)}")
    print("=== resolve relevance ===")
    return resolve_relevant(urls)


def fix_mislabeled_babyspace(sb) -> int:
    rows = (
        sb.table("rag_sources")
        .select("id,origin,source_url,source_key")
        .eq("source_key", SOURCE_KEY)
        .limit(2000)
        .execute()
        .data
        or []
    )
    fixed = 0
    for row in rows:
        origin = (row.get("origin") or row.get("source_url") or "").lower()
        if "babyspace.gr" not in origin:
            continue
        sid = row["id"]
        sb.table("rag_sources").update({"source_key": "babyspace"}).eq("id", sid).execute()
        try:
            chunks = (
                sb.table("rag_chunks")
                .select("id,metadata")
                .eq("source_id", sid)
                .limit(500)
                .execute()
                .data
                or []
            )
            for ch in chunks:
                meta = dict(ch.get("metadata") or {})
                meta["source_key"] = "babyspace"
                sb.table("rag_chunks").update({"metadata": meta}).eq("id", ch["id"]).execute()
        except Exception:
            pass
        fixed += 1
    return fixed


def delete_irrelevant_eody(sb, keep_urls: set[str]) -> tuple[int, int]:
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
        keep = origin in keep_urls or is_eody_baby_childhood_url(origin, title=title)
        if "eody.gov.gr" not in origin.lower():
            keep = False
        if keep and not SKIP_RE.search(origin):
            # Also drop if neither disease keep nor topic
            if not (
                DISEASE_KEEP_RE.search(f"{title} {origin}")
                or TOPIC_RE.search(f"{title} {origin}")
                or origin in keep_urls
            ):
                keep = False
        if keep:
            continue
        sid = row["id"]
        sb.table("rag_chunks").delete().eq("source_id", sid).execute()
        deleted_chunks += int(row.get("chunk_count") or 0)
        sb.table("rag_sources").delete().eq("id", sid).execute()
        deleted_sources += 1
        print(f"delete {title[:50]} | {origin[:90]}")
    return deleted_sources, deleted_chunks


def ingest_candidates(sb, candidates: dict[str, str], *, max_ingest: int = 50) -> int:
    added = 0
    ordered = sorted(
        candidates.items(),
        key=lambda it: (
            0 if "/nosimata-kai-themata-ygeias/" in it[0] else 1,
            0 if TOPIC_RE.search(it[1] or "") or DISEASE_KEEP_RE.search(it[1] or "") else 1,
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


def update_knowledge_source_filter(sb) -> None:
    try:
        row = (
            sb.table("knowledge_sources")
            .select("metadata")
            .eq("source_key", SOURCE_KEY)
            .limit(1)
            .execute()
            .data
            or [None]
        )[0]
        meta = dict((row or {}).get("metadata") or {})
        meta["discover"] = "crawl"
        meta["topic_filter"] = "baby_childhood"
        meta["topic_include_regex"] = TOPIC_RE.pattern
        meta["topic_exclude_regex"] = SKIP_RE.pattern
        meta["max_urls"] = 80
        meta.pop("rss", None)
        sb.table("knowledge_sources").update(
            {
                "metadata": meta,
                "enabled": True,
                "base_url": (
                    "https://eody.gov.gr/el/nosimata/metadotika/"
                    "nosimata-kai-themata-ygeias.html"
                ),
            }
        ).eq("source_key", SOURCE_KEY).execute()
        print("updated knowledge_sources metadata for eody topic filter")
    except Exception as e:
        print(f"ks update fail: {e}")


def main() -> int:
    url = clean(os.getenv("SUPABASE_URL"))
    key = clean(os.getenv("SUPABASE_SERVICE_KEY"))
    if not url or not key:
        print("missing supabase credentials")
        return 2
    sb = create_client(url, key)

    print("=== fix mislabeled babyspace ===")
    fixed = fix_mislabeled_babyspace(sb)
    print(f"fixed source_key babyspace: {fixed}")

    print("=== discover eody baby/childhood urls ===")
    candidates = discover_candidate_urls()
    print(f"candidates: {len(candidates)}")
    for u, t in list(candidates.items())[:60]:
        print(f"  - {(t or '')[:50]} | {u}")

    keep = set(candidates.keys())
    print("=== delete irrelevant eody ===")
    deleted_s, deleted_c = delete_irrelevant_eody(sb, keep)
    print(f"deleted sources={deleted_s} approx_chunks={deleted_c}")

    print("=== ingest relevant eody ===")
    added = ingest_candidates(sb, candidates, max_ingest=50)
    print(f"ingested/updated: {added}")

    update_knowledge_source_filter(sb)

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
        f"READY eody sources: {len(srcs)} "
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
