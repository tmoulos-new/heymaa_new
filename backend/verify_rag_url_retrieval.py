"""
Verify RAG retrieval returns knowledge chunks for a sample parenting query.

Requires GEMINI_API_KEY + Supabase credentials.

Usage:
  python backend/verify_rag_url_retrieval.py
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

import requests
from supabase import create_client

from rag_retrieve import retrieve_hybrid


def _clean(v: str | None) -> str:
    return (v or "").strip().strip('"').strip("'")


def _embed(gkey: str, text: str) -> list[float]:
    r = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={gkey}",
        json={
            "model": "models/gemini-embedding-001",
            "content": {"parts": [{"text": text}]},
            "taskType": "RETRIEVAL_QUERY",
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["embedding"]["values"]


def main() -> int:
    url = _clean(os.getenv("SUPABASE_URL"))
    key = _clean(os.getenv("SUPABASE_SERVICE_KEY"))
    gemini = _clean(os.getenv("GEMINI_API_KEY") or os.getenv("Gemini_Heymaa_API_Key"))
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
    emb = _embed(gemini, query)
    rows, meta = retrieve_hybrid(
        sb,
        supabase_url=url,
        service_key=key,
        query=query,
        query_embedding=emb,
        top_k=8,
        threshold=0.2,
    )
    print(f"retrieve path={meta.get('path')} candidates={meta.get('candidates')} hits={len(rows)}")
    hit_url = 0
    for r in rows:
        meta_row = r.get("metadata") or {}
        title = meta_row.get("title")
        source_url = meta_row.get("source_url") or ""
        print(f"- {title} | {source_url[:80]} | score={r.get('similarity')}")
        if source_url or (meta_row.get("source_type") == "url"):
            hit_url += 1
        sid = r.get("source_id")
        if any(s["id"] == sid for s in url_sources):
            hit_url += 1
    if hit_url < 1 and not rows:
        print("FAIL: retrieval returned no chunks")
        return 3
    if not rows:
        print("FAIL: empty retrieval")
        return 3
    print("PASS: knowledge is retrievable for chat RAG")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
