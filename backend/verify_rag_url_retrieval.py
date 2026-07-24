"""
Verify RAG retrieval returns seed URL chunks for a sample parenting query.

Requires GEMINI_API_KEY + Supabase credentials.

Usage:
  .\\.venv\\Scripts\\python.exe backend/verify_rag_url_retrieval.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env", override=False)
load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

sys.path.insert(0, str(Path(__file__).resolve().parent))

from supabase import create_client

from rag_ingest import get_document_embedding


def _clean(v: str | None) -> str:
    return (v or "").strip().strip('"').strip("'")


def main() -> int:
    url = _clean(os.getenv("SUPABASE_URL"))
    key = _clean(os.getenv("SUPABASE_SERVICE_KEY"))
    gemini = _clean(os.getenv("GEMINI_API_KEY"))
    if not url or not key or not gemini:
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY / GEMINI_API_KEY")
        return 1
    os.environ["GEMINI_API_KEY"] = gemini
    sb = create_client(url, key)

    sources = sb.table("rag_sources").select("id,title,source_type,origin,status,chunk_count").execute().data or []
    url_sources = [s for s in sources if (s.get("source_type") or "") == "url" and (s.get("status") or "") == "ready"]
    print(f"ready url sources: {len(url_sources)} / total sources {len(sources)}")
    if not url_sources:
        print("FAIL: no ready URL sources in rag_sources")
        return 2

    query = "συμβουλές για εγκυμοσύνη και θηλασμό"
    emb = get_document_embedding(query)
    # query embedding uses RETRIEVAL_DOCUMENT task in helper; chat uses default — still useful smoke test
    result = sb.rpc(
        "match_chunks",
        {"query_embedding": emb, "match_count": 8, "match_threshold": 0.2},
    ).execute()
    rows = result.data or []
    print(f"match_chunks returned: {len(rows)}")
    hit_url = 0
    for r in rows:
        meta = r.get("metadata") or {}
        title = meta.get("title")
        source_url = meta.get("source_url") or ""
        print(f"- {title} | {source_url[:80]} | score={r.get('similarity')}")
        if source_url or (meta.get("source_type") == "url"):
            hit_url += 1
        # also detect by origin via source_id
        sid = r.get("source_id")
        if any(s["id"] == sid for s in url_sources):
            hit_url += 1
    if hit_url < 1:
        print("FAIL: retrieval did not return URL-sourced chunks")
        return 3
    print("PASS: URL knowledge is retrievable for chat RAG")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
