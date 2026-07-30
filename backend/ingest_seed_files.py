"""
Ingest locally saved seed markdown from backend/knowledge_seed into rag_*.

Requires GEMINI_API_KEY in environment or .env.

Usage:
  .\\.venv\\Scripts\\python.exe backend/ingest_seed_files.py
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT / ".env", override=False)
load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

sys.path.insert(0, str(Path(__file__).resolve().parent))

from supabase import create_client

from rag_ingest import create_or_update_url_source_and_ingest, ingest_text_into_source


def _clean(v: str | None) -> str:
    return (v or "").strip().strip('"').strip("'")


def main() -> int:
    url = _clean(os.getenv("SUPABASE_URL"))
    key = _clean(os.getenv("SUPABASE_SERVICE_KEY"))
    gemini = _clean(os.getenv("GEMINI_API_KEY"))
    if not url or not key:
        print("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY")
        return 1
    if not gemini:
        print("Missing GEMINI_API_KEY — set it in .env to vectorize seed content.")
        return 2
    os.environ["GEMINI_API_KEY"] = gemini

    seed_dir = Path(__file__).resolve().parent / "knowledge_seed"
    files = sorted(seed_dir.glob("*.md")) + sorted((seed_dir / "milestones").glob("*.md"))
    # de-dupe by path
    seen = set()
    uniq = []
    for path in files:
        if path in seen:
            continue
        seen.add(path)
        uniq.append(path)
    files = uniq
    if not files:
        print("No seed markdown files found. Run URL acquisition first.")
        return 1

    sb = create_client(url, key)
    ok = 0
    for path in files:
        raw = path.read_text(encoding="utf-8")
        meta = {}
        body = raw
        if raw.startswith("---"):
            parts = raw.split("---", 2)
            if len(parts) >= 3:
                try:
                    meta = json.loads(parts[1])
                except Exception:
                    meta = {}
                body = parts[2].strip()
        # strip leading markdown title
        body = re.sub(r"^#\s+.*\n+", "", body).strip()
        page_url = meta.get("url") or f"seed://{path.name}"
        title = meta.get("title") or path.stem
        source_key = meta.get("source_key")
        language = meta.get("language") or "el"
        print(f"Ingest {path.name} -> {page_url}")
        try:
            if str(page_url).startswith("http"):
                # Prefer live re-fetch when possible for freshness; fall back to file body
                try:
                    result = create_or_update_url_source_and_ingest(
                        sb,
                        url=page_url,
                        title=title,
                        source_key=source_key,
                        language=language,
                        sleep_seconds=0.08,
                    )
                except Exception:
                    # fall through to local body
                    existing = (
                        sb.table("rag_sources")
                        .select("*")
                        .eq("origin", page_url)
                        .limit(1)
                        .execute()
                    )
                    if existing.data:
                        source_id = existing.data[0]["id"]
                        sb.table("rag_sources").update(
                            {
                                "title": title,
                                "source_type": "url",
                                "origin": page_url,
                                "status": "processing",
                            }
                        ).eq("id", source_id).execute()
                    else:
                        inserted = (
                            sb.table("rag_sources")
                            .insert(
                                {
                                    "title": title,
                                    "source_type": "url",
                                    "origin": page_url,
                                    "status": "processing",
                                    "chunk_count": 0,
                                }
                            )
                            .execute()
                        )
                        source_id = inserted.data[0]["id"]
                    result = ingest_text_into_source(
                        sb,
                        source_id=source_id,
                        title=title,
                        text=body,
                        replace_existing=True,
                        sleep_seconds=0.08,
                        metadata_extra={
                            "source_url": page_url,
                            "source_key": source_key,
                            "language": language,
                            "source_type": "url",
                        },
                    )
            else:
                raise ValueError("non-http seed")
            print(f"  OK chunks={result.get('chunk_count')}")
            ok += 1
        except Exception as e:
            print(f"  FAIL {e}")
    print(f"Done ok={ok}/{len(files)}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
