"""
Seed Babyspace + My Parenthood URLs into HeyMaa rag_sources / rag_chunks.

Usage (from repo root):
  .\\.venv\\Scripts\\python.exe backend/ingest_parenthood_urls.py
  .\\.venv\\Scripts\\python.exe backend/ingest_parenthood_urls.py --max-per-source 15
"""
from __future__ import annotations

import argparse
import os
import sys

from dotenv import load_dotenv

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(_ROOT, ".env"), override=False)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

sys.path.insert(0, os.path.dirname(__file__))

from supabase import create_client

from rag_ingest import create_or_update_url_source_and_ingest
from url_acquire import SEED_SOURCES, discover_source_urls


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest parenthood seed URLs into RAG")
    parser.add_argument("--max-per-source", type=int, default=20)
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        help="Limit to source_key (babyspace|myparenthood). Repeatable.",
    )
    args = parser.parse_args()

    url = (os.getenv("SUPABASE_URL") or "").strip().strip('"').strip("'")
    key = (os.getenv("SUPABASE_SERVICE_KEY") or "").strip().strip('"').strip("'")
    gemini = (os.getenv("GEMINI_API_KEY") or "").strip().strip('"').strip("'")
    if not url or not key:
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY")
        return 1
    if not gemini:
        print("Missing GEMINI_API_KEY (check root .env and backend/.env)")
        return 1
    os.environ["GEMINI_API_KEY"] = gemini
    os.environ["SUPABASE_URL"] = url
    os.environ["SUPABASE_SERVICE_KEY"] = key

    sb = create_client(url, key)
    wanted = set(args.sources or [])
    max_per = max(1, min(args.max_per_source, 50))

    ok = 0
    fail = 0
    for src in SEED_SOURCES:
        if wanted and src["source_key"] not in wanted:
            continue
        print(f"\n=== {src['name']} ({src['source_key']}) ===")
        urls = discover_source_urls(
            base_url=src["base_url"],
            sitemap_url=src.get("sitemap_url"),
            max_urls=max_per,
        )
        print(f"Discovered {len(urls)} URLs (cap={max_per})")
        for i, u in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] {u}")
            try:
                result = create_or_update_url_source_and_ingest(
                    sb,
                    url=u,
                    source_key=src["source_key"],
                    language=src.get("language") or "el",
                    sleep_seconds=0.08,
                )
                print(
                    f"  OK chunks={result.get('chunk_count')} "
                    f"words={result.get('word_count')} status={result.get('status')}"
                )
                ok += 1
            except Exception as e:
                print(f"  FAIL {e}")
                fail += 1

    print(f"\nDone. ok={ok} fail={fail}")
    return 0 if ok > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
