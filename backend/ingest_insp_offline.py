"""Ingest pre-fetched INSP childhood texts into RAG (when live insp.gov.ro is blocked).

Usage:
  python backend/ingest_insp_offline.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env", override=False)
load_dotenv(_ROOT / "backend" / ".env", override=True)
sys.path.insert(0, str(_ROOT / "backend"))

from supabase import create_client

from rag_ingest import ingest_text_into_source
from url_acquire import normalize_url, url_hash

SOURCE_KEY = "insp-gov-ro"
BUNDLE = Path(__file__).resolve().parent / "_insp_offline_docs.jsonl"


def clean(v: str | None) -> str:
    return (v or "").strip().strip('"').strip("'")


def upsert_source(sb, *, url: str, title: str) -> str:
    source_url = normalize_url(url)
    payload = {
        "title": title[:300],
        "source_type": "url",
        "origin": source_url,
        "source_url": source_url,
        "source_key": SOURCE_KEY,
        "language": "ro",
        "enabled": True,
        "status": "processing",
        "chunk_count": 0,
    }
    existing = (
        sb.table("rag_sources")
        .select("id")
        .eq("origin", source_url)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not existing:
        existing = (
            sb.table("rag_sources")
            .select("id")
            .eq("source_url", source_url)
            .limit(1)
            .execute()
            .data
            or []
        )
    if existing:
        sid = existing[0]["id"]
        try:
            sb.table("rag_sources").update(payload).eq("id", sid).execute()
        except Exception:
            sb.table("rag_sources").update(
                {
                    "title": payload["title"],
                    "source_type": "url",
                    "origin": source_url,
                    "status": "processing",
                    "chunk_count": 0,
                }
            ).eq("id", sid).execute()
        return sid
    inserted = sb.table("rag_sources").insert(payload).execute()
    if not inserted.data:
        raise ValueError(f"Failed to create source for {source_url}")
    return inserted.data[0]["id"]


def upsert_knowledge_source(sb) -> None:
    base = "https://insp.gov.ro/"
    meta = {
        "discover": "crawl",
        "topic_filter": "baby_childhood",
        "max_urls": 80,
        "seed": True,
    }
    row = {
        "source_key": SOURCE_KEY,
        "name": "INSP (România)",
        "source_type": "website",
        "language": "ro",
        "base_url": base,
        "enabled": True,
        "metadata": meta,
    }
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
    print("updated knowledge_sources for insp-gov-ro")


def main() -> int:
    url = clean(os.getenv("SUPABASE_URL"))
    key = clean(os.getenv("SUPABASE_SERVICE_KEY"))
    if not url or not key:
        print("missing supabase credentials")
        return 2
    if not BUNDLE.exists():
        print(f"missing bundle: {BUNDLE}")
        return 2

    sb = create_client(url, key)
    upsert_knowledge_source(sb)

    docs = []
    with BUNDLE.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            docs.append(json.loads(line))

    added = 0
    for doc in docs:
        page_url = doc["url"]
        title = doc.get("title") or page_url
        text = (doc.get("content") or "").strip()
        if len(text.split()) < 40:
            print(f"skip short: {title}")
            continue
        try:
            sid = upsert_source(sb, url=page_url, title=title)
            result = ingest_text_into_source(
                sb,
                source_id=sid,
                title=title,
                text=text,
                replace_existing=True,
                sleep_seconds=0.05,
                metadata_extra={
                    "source_key": SOURCE_KEY,
                    "language": "ro",
                    "origin": normalize_url(page_url),
                    "url_hash": url_hash(page_url),
                    "offline_bundle": True,
                },
            )
            added += 1
            print(f"ingested {added}: {title[:60]} chunks={result.get('chunk_count')}")
        except Exception as e:
            print(f"fail {page_url}: {e}")

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
        f"READY insp sources: {len(srcs)} "
        f"chunks={sum(int(s.get('chunk_count') or 0) for s in srcs)}"
    )
    return 0 if added else 1


if __name__ == "__main__":
    raise SystemExit(main())
