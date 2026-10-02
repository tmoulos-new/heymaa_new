"""Re-ingest MOH PDF attachments with table-aware extraction."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env", override=False)
load_dotenv(_ROOT / "backend" / ".env", override=True)
sys.path.insert(0, str(_ROOT / "backend"))

from supabase import create_client

from rag_ingest import extract_text_from_pdf_bytes, ingest_text_into_source

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"}
SOURCE_KEY = "moh-gov-gr"


def clean(v: str | None) -> str:
    return (v or "").strip().strip('"').strip("'")


def main() -> int:
    url = clean(os.getenv("SUPABASE_URL"))
    key = clean(os.getenv("SUPABASE_SERVICE_KEY"))
    if not url or not key:
        print("missing supabase credentials")
        return 2
    sb = create_client(url, key)

    rows = (
        sb.table("rag_sources")
        .select("id,title,origin,chunk_count,status")
        .eq("source_key", SOURCE_KEY)
        .eq("status", "ready")
        .ilike("origin", "%?dl=1%")
        .limit(200)
        .execute()
        .data
        or []
    )
    # Prefer schedule / vaccine PDFs first
    def score(r: dict) -> tuple:
        o = ((r.get("title") or "") + (r.get("origin") or "")).lower()
        pri = 0
        if any(x in o for x in ("xronodiagram", "2026", "2025", "2024", "epe-paidiwn", "nirsevimab", "rsv", "pcv20")):
            pri -= 10
        return (pri, -(int(r.get("chunk_count") or 0)), r.get("origin") or "")

    rows = sorted(rows, key=score)
    print(f"pdf sources to refresh: {len(rows)}")

    updated = 0
    for row in rows:
        origin = row.get("origin") or ""
        title = row.get("title") or origin
        try:
            resp = requests.get(origin, headers=UA, timeout=90, allow_redirects=True)
            resp.raise_for_status()
            data = resp.content
            if data[:5] != b"%PDF-":
                print(f"skip not-pdf {origin}")
                continue
            text = extract_text_from_pdf_bytes(data)
            has_table = "[Πίνακας" in text or "\n| " in text
            print(
                f"extract words={len(text.split())} tables={'yes' if has_table else 'no'} "
                f"{title[:70]}"
            )
            if len(text.split()) < 40:
                print("skip short")
                continue
            result = ingest_text_into_source(
                sb,
                source_id=row["id"],
                text=text,
                title=title[:300],
                replace_existing=True,
                sleep_seconds=0.05,
                metadata_extra={
                    "source_key": SOURCE_KEY,
                    "origin": origin,
                    "content_type": "pdf",
                    "table_aware": True,
                },
            )
            updated += 1
            print(f"updated {updated}: chunks={result.get('chunk_count')} {title[:65]}")
        except Exception as e:
            print(f"fail {origin}: {e}")
        time.sleep(0.12)

    # Show a sample table chunk
    sample = (
        sb.table("rag_sources")
        .select("id,title")
        .eq("source_key", SOURCE_KEY)
        .ilike("origin", "%13728%?dl=1%")
        .limit(1)
        .execute()
        .data
        or []
    )
    if sample:
        ch = (
            sb.table("rag_chunks")
            .select("content,metadata")
            .eq("source_id", sample[0]["id"])
            .limit(40)
            .execute()
            .data
            or []
        )
        tableish = [c for c in ch if "| ---" in (c.get("content") or "") or "[Πίνακας" in (c.get("content") or "")]
        print(f"\nsample tableish chunks: {len(tableish)} / {len(ch)}")
        if tableish:
            print(tableish[0]["content"][:1200])

    print(f"done updated={updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
