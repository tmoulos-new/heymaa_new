"""RAG corpus health + unattended maintenance ticks (Vercel cron friendly)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

# How long a discovering/running job can sit idle before we cancel it.
STALE_JOB_HOURS = 2
# Cron tick budget per invocation (each tick is a small discover/ingest step).
DEFAULT_TICKS_PER_CRON = 8
# Auto-enqueue cadence
REBUILD_EMPTY_HOURS = 24
ADD_NEW_HOURS = 72  # ~every 3 days
MAINTAINED_KEYS = ("babyspace", "myparenthood")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _job_mode(row: dict[str, Any]) -> str:
    urls = row.get("urls") or []
    max_pages = int(row.get("max_discover_pages") or 250)
    if max_pages == 0 and urls:
        return "rebuild_empty"
    return "add_new"


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
    """Global (unfiltered) corpus health for admin + cron decisions."""
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

        key = (row.get("source_key") or "").strip().lower() or "other"
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
        "auto": {
            "rebuild_empty_hours": REBUILD_EMPTY_HOURS,
            "add_new_hours": ADD_NEW_HOURS,
            "maintained_keys": list(MAINTAINED_KEYS),
            "cron_ticks": DEFAULT_TICKS_PER_CRON,
        },
    }


def cancel_stale_jobs(sb) -> list[str]:
    try:
        from .rag_seed_jobs import cancel_seed_job, list_seed_jobs
    except ImportError:
        from rag_seed_jobs import cancel_seed_job, list_seed_jobs

    cancelled: list[str] = []
    cutoff = _now() - timedelta(hours=STALE_JOB_HOURS)
    try:
        jobs = list_seed_jobs(sb, limit=30)
    except Exception:
        return cancelled
    for job in jobs:
        status = (job.get("status") or "").lower()
        if status not in ("queued", "discovering", "running"):
            continue
        updated = _parse_iso(job.get("updated_at")) or _parse_iso(job.get("created_at"))
        if not updated or updated > cutoff:
            continue
        jid = str(job.get("id") or "")
        if not jid:
            continue
        try:
            cancel_seed_job(sb, jid)
            cancelled.append(jid)
        except Exception:
            continue
    return cancelled


def _recent_job_for(
    jobs: list[dict[str, Any]],
    *,
    source_key: str,
    mode: str,
    within_hours: float,
) -> Optional[dict[str, Any]]:
    cutoff = _now() - timedelta(hours=within_hours)
    for job in jobs:
        if (job.get("source_key") or "").lower() != source_key:
            continue
        if _job_mode(job) != mode:
            continue
        created = _parse_iso(job.get("created_at")) or _parse_iso(job.get("updated_at"))
        if created and created >= cutoff:
            return job
    return None


def _active_job(jobs: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    for job in jobs:
        if (job.get("status") or "") in ("queued", "discovering", "running"):
            return job
    return None


def maybe_enqueue_maintenance(sb, health: dict[str, Any]) -> Optional[dict[str, Any]]:
    """If idle, enqueue rebuild_empty (daily) or add_new (~3 days) for maintained sites."""
    try:
        from .rag_seed_jobs import create_seed_job, list_seed_jobs
    except ImportError:
        from rag_seed_jobs import create_seed_job, list_seed_jobs

    try:
        jobs = list_seed_jobs(sb, limit=40)
    except Exception:
        return None
    if _active_job(jobs):
        return None

    by_key = health.get("by_source_key") or {}

    # Prefer repairing broken rows first.
    for key in MAINTAINED_KEYS:
        broken = int((by_key.get(key) or {}).get("broken") or 0)
        if broken < 1:
            continue
        if _recent_job_for(jobs, source_key=key, mode="rebuild_empty", within_hours=REBUILD_EMPTY_HOURS):
            continue
        return create_seed_job(sb, source_key=key, mode="rebuild_empty", batch_size=5)

    # Then incremental discovery for new pages.
    for key in MAINTAINED_KEYS:
        if _recent_job_for(jobs, source_key=key, mode="add_new", within_hours=ADD_NEW_HOURS):
            continue
        since = 5.0 if key == "babyspace" else 5.0
        return create_seed_job(
            sb,
            source_key=key,
            mode="add_new",
            since_years=since,
            batch_size=5,
        )
    return None


def run_maintenance_tick(
    sb,
    *,
    max_ticks: int = DEFAULT_TICKS_PER_CRON,
    enqueue: bool = True,
) -> dict[str, Any]:
    """
    One cron invocation:
    1) cancel stale jobs
    2) optionally enqueue rebuild/add_new when idle
    3) advance the active job with several small ticks
    """
    try:
        from .rag_seed_jobs import get_seed_job, job_public, list_seed_jobs, tick_seed_job
    except ImportError:
        from rag_seed_jobs import get_seed_job, job_public, list_seed_jobs, tick_seed_job

    health = compute_rag_health(sb)
    cancelled = cancel_stale_jobs(sb)
    enqueued = None
    if enqueue:
        try:
            enqueued = maybe_enqueue_maintenance(sb, health)
        except Exception as e:
            return {
                "ok": False,
                "error": f"enqueue failed: {e}",
                "cancelled": cancelled,
                "ticks": 0,
                "health": health,
            }

    ticks_done = 0
    last_job = None
    try:
        jobs = list_seed_jobs(sb, limit=10)
        active = _active_job(jobs)
    except Exception as e:
        return {
            "ok": False,
            "error": f"list jobs failed: {e}",
            "cancelled": cancelled,
            "enqueued": job_public(enqueued) if enqueued else None,
            "ticks": 0,
            "health": health,
        }

    if active and active.get("id"):
        jid = str(active["id"])
        budget = max(1, min(int(max_ticks or DEFAULT_TICKS_PER_CRON), 20))
        for _ in range(budget):
            try:
                last_job = tick_seed_job(sb, jid)
            except Exception as e:
                return {
                    "ok": False,
                    "error": str(e),
                    "cancelled": cancelled,
                    "enqueued": job_public(enqueued) if enqueued else None,
                    "ticks": ticks_done,
                    "job": job_public(get_seed_job(sb, jid) or active),
                    "health": compute_rag_health(sb),
                }
            ticks_done += 1
            status = (last_job.get("status") or "").lower()
            if status in ("completed", "failed", "cancelled"):
                break

    refreshed = compute_rag_health(sb)
    return {
        "ok": True,
        "cancelled": cancelled,
        "enqueued": job_public(enqueued) if enqueued else None,
        "ticks": ticks_done,
        "job": job_public(last_job) if last_job else refreshed.get("active_job"),
        "health": refreshed,
    }
