"""Backfill rag_sources.published_at from live HTML (no re-embed).

Usage:
  python backfill_published_at.py           # all URL sources missing published_at
  python backfill_published_at.py --limit 50
  python backfill_published_at.py --source-key babyspace
"""
from __future__ import annotations

import argparse
import os
import time
from typing import Any, Optional

from dotenv import load_dotenv
from supabase import create_client

from url_acquire import extract_published_at, fetch_url, normalize_url

load_dotenv()


def _client():
    return create_client(
        os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_KEY"),
    )


def _list_missing(sb, *, source_key: Optional[str], limit: Optional[int]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    page = 1000
    start = 0
    while True:
        q = (
            sb.table("rag_sources")
            .select("id,source_url,origin,source_key,published_at,status")
            .is_("published_at", "null")
            .range(start, start + page - 1)
        )
        if source_key:
            q = q.eq("source_key", source_key)
        res = q.execute()
        rows = list(res.data or [])
        if not rows:
            break
        for row in rows:
            url = (row.get("source_url") or row.get("origin") or "").strip()
            if not url.startswith("http"):
                continue
            if (row.get("status") or "").lower() in ("unavailable", "gone", "dead"):
                continue
            out.append(row)
            if limit is not None and len(out) >= limit:
                return out
        if len(rows) < page:
            break
        start += page
    return out


def _fetch_html(url: str) -> Optional[str]:
    try:
        _final, ctype, body = fetch_url(url, timeout=20)
        if "html" not in (ctype or "") and not (body or "").lstrip().startswith("<"):
            return None
        return body
    except Exception:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-key", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sleep", type=float, default=0.25)
    ap.add_argument("--also-chunks", action="store_true", help="Also stamp chunk metadata")
    args = ap.parse_args()

    sb = _client()
    rows = _list_missing(sb, source_key=args.source_key, limit=args.limit)
    print(f"candidates={len(rows)}")
    found = 0
    missing = 0
    errors = 0
    for i, row in enumerate(rows, 1):
        rid = row["id"]
        raw = (row.get("source_url") or row.get("origin") or "").strip()
        try:
            url = normalize_url(raw)
        except Exception:
            url = raw
        html = _fetch_html(url)
        if not html:
            errors += 1
            if i % 25 == 0 or i == len(rows):
                print(f"… {i}/{len(rows)} found={found} missing={missing} errors={errors}")
            time.sleep(args.sleep)
            continue
        dt = extract_published_at(html)
        if not dt:
            missing += 1
        else:
            iso = dt.isoformat()
            try:
                sb.table("rag_sources").update({"published_at": iso}).eq("id", rid).execute()
                found += 1
                if args.also_chunks:
                    # Best-effort: patch metadata.published_at on chunks for this source
                    ch = (
                        sb.table("rag_chunks")
                        .select("id,metadata")
                        .eq("source_id", rid)
                        .limit(50)
                        .execute()
                    )
                    for c in ch.data or []:
                        meta = c.get("metadata") if isinstance(c.get("metadata"), dict) else {}
                        meta = dict(meta)
                        meta["published_at"] = iso
                        try:
                            sb.table("rag_chunks").update({"metadata": meta}).eq(
                                "id", c["id"]
                            ).execute()
                        except Exception:
                            pass
            except Exception as e:
                errors += 1
                print(f"update fail {rid}: {e}")
        if i % 25 == 0 or i == len(rows):
            print(f"… {i}/{len(rows)} found={found} missing={missing} errors={errors}")
        time.sleep(args.sleep)
    print(f"DONE found={found} no_date_on_page={missing} fetch_errors={errors}")


if __name__ == "__main__":
    main()
