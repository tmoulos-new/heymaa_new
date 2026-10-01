"""RAG corpus health helpers for the admin Sources tab."""

from __future__ import annotations

from typing import Any


def _count_rag_chunks_exact(sb) -> int:
    """Total rag_chunks rows — uses PostgREST exact count (not capped at 1000)."""
    try:
        res = sb.table("rag_chunks").select("id", count="exact", head=True).execute()
        count = getattr(res, "count", None)
        if count is not None:
            return int(count)
    except Exception:
        pass
    # Fallback: page through ids if head-count is unavailable.
    total = 0
    page_size = 1000
    offset = 0
    try:
        while True:
            res = (
                sb.table("rag_chunks")
                .select("id")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            rows = res.data or []
            total += len(rows)
            if len(rows) < page_size:
                break
            offset += page_size
    except Exception:
        return total
    return total


def _list_rag_sources_paged(sb, columns: str) -> list[dict[str, Any]]:
    """Page through rag_sources to avoid PostgREST's default ~1000-row cap."""
    rows: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0
    while True:
        res = (
            sb.table("rag_sources")
            .select(columns)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def compute_rag_health(sb) -> dict[str, Any]:
    """Global (unfiltered) corpus health for the admin Sources tab."""
    try:
        from .rag_seed_jobs import job_public, list_seed_jobs
    except ImportError:
        from rag_seed_jobs import job_public, list_seed_jobs

    totals = {
        "sources": 0,
        "ready": 0,
        "processing": 0,
        "error": 0,
        "empty_chunks": 0,
        "broken": 0,
        "chunks": 0,
        "urls": 0,
        "files": 0,
    }
    by_key: dict[str, dict[str, int]] = {}

    try:
        rows = _list_rag_sources_paged(
            sb, "id,status,chunk_count,source_type,source_key,origin"
        )
    except Exception as e:
        return {"ok": False, "error": str(e), **totals, "by_source_key": {}, "active_job": None}

    # Prefer live table count so the admin tile is never stuck at a 1000-row cap
    # or stale stored chunk_count sums.
    totals["chunks"] = _count_rag_chunks_exact(sb)

    for row in rows:
        totals["sources"] += 1
        st = (row.get("status") or "").lower()
        chunks = int(row.get("chunk_count") or 0)
        if st == "ready":
            totals["ready"] += 1
        elif st == "processing":
            totals["processing"] += 1
        elif st == "error":
            totals["error"] += 1
        if chunks < 1:
            totals["empty_chunks"] += 1
        if st == "error" or chunks < 1:
            totals["broken"] += 1

        stype = (row.get("source_type") or "").lower()
        origin = (row.get("origin") or "").strip()
        if stype == "url" or origin.startswith("http"):
            totals["urls"] += 1
        else:
            totals["files"] += 1

        key = (row.get("source_key") or "").strip().lower()
        if key not in ("babyspace", "myparenthood"):
            origin_l = (origin or row.get("source_url") or "").lower()
            if "babyspace.gr" in origin_l:
                key = "babyspace"
            elif "myparenthood.gr" in origin_l:
                key = "myparenthood"
            elif not key:
                key = "other"
        bucket = by_key.setdefault(
            key,
            {"sources": 0, "ready": 0, "error": 0, "empty_chunks": 0, "broken": 0},
        )
        bucket["sources"] += 1
        if st == "ready":
            bucket["ready"] += 1
        if st == "error":
            bucket["error"] += 1
        if chunks < 1:
            bucket["empty_chunks"] += 1
        if st == "error" or chunks < 1:
            bucket["broken"] += 1

    active_job = None
    recent_jobs: list[dict[str, Any]] = []
    try:
        jobs = list_seed_jobs(sb, limit=12)
        for job in jobs:
            pub = job_public(job)
            recent_jobs.append(pub)
            if active_job is None and (job.get("status") or "") in (
                "queued",
                "discovering",
                "running",
            ):
                active_job = pub
    except Exception:
        recent_jobs = []

    return {
        "ok": True,
        **totals,
        "by_source_key": by_key,
        "active_job": active_job,
        "recent_jobs": recent_jobs[:5],
    }
