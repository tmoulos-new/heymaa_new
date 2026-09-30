"""Background-friendly RAG seed jobs (small ticks so Vercel does not time out)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

DISCOVER_PAGES_PER_TICK = 3
DEFAULT_BATCH_SIZE = 5
MAX_BATCH_SIZE = 10


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def job_public(row: dict[str, Any]) -> dict[str, Any]:
    urls = row.get("urls") or []
    if not isinstance(urls, list):
        urls = []
    discover_page = int(row.get("discover_page") or 1)
    max_pages = int(row.get("max_discover_pages") or 250)
    mode = "rebuild_empty" if max_pages == 0 and urls else "add_new"
    return {
        "id": row.get("id"),
        "source_key": row.get("source_key"),
        "status": row.get("status"),
        "mode": mode,
        "since_years": row.get("since_years"),
        "batch_size": row.get("batch_size"),
        "discover_page": discover_page,
        "max_discover_pages": max_pages,
        "cursor_idx": row.get("cursor_idx"),
        "discovered": row.get("discovered") or len(urls),
        "queued": len(urls),
        "ingested": row.get("ingested") or 0,
        "skipped": row.get("skipped") or 0,
        "failed": row.get("failed") or 0,
        "last_error": row.get("last_error"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "discover_done": discover_page > max_pages,
        "done": (row.get("status") or "") in ("completed", "failed", "cancelled"),
    }


def _ready_origins_for_source(sb, source_key: str) -> set[str]:
    """URLs already ingested OK for this source_key (skip on re-seed)."""
    out: set[str] = set()
    try:
        res = (
            sb.table("rag_sources")
            .select("origin,source_url,status,chunk_count")
            .eq("source_key", source_key)
            .eq("status", "ready")
            .execute()
        )
    except Exception:
        return out
    for row in res.data or []:
        if int(row.get("chunk_count") or 0) < 1:
            continue
        for key in ("source_url", "origin"):
            val = (row.get(key) or "").strip()
            if val:
                out.add(val.split("?")[0])
    return out


def _broken_urls_for_source(sb, source_key: str) -> list[str]:
    """URLs that need rebuild: error status, or ready/processing with no chunks."""
    out: list[str] = []
    seen: set[str] = set()
    try:
        res = (
            sb.table("rag_sources")
            .select("origin,source_url,status,chunk_count,source_type")
            .eq("source_key", source_key)
            .execute()
        )
    except Exception:
        return out
    for row in res.data or []:
        st = (row.get("status") or "").lower()
        chunks = int(row.get("chunk_count") or 0)
        needs = st == "error" or chunks < 1
        if not needs:
            continue
        for key in ("source_url", "origin"):
            val = (row.get(key) or "").strip()
            if not val or not val.startswith("http"):
                continue
            norm = val.split("?")[0]
            if norm in seen:
                continue
            seen.add(norm)
            out.append(val)
            break
    return out


def create_seed_job(
    sb,
    *,
    source_key: str,
    since_years: Optional[float] = 5.0,
    batch_size: int = DEFAULT_BATCH_SIZE,
    max_discover_pages: int = 250,
    created_by: Optional[str] = None,
    mode: str = "add_new",
) -> dict[str, Any]:
    key = (source_key or "").strip().lower()
    if key not in ("babyspace", "myparenthood"):
        raise ValueError("source_key must be babyspace or myparenthood")
    job_mode = (mode or "add_new").strip().lower()
    if job_mode not in ("add_new", "rebuild_empty"):
        raise ValueError("mode must be add_new or rebuild_empty")

    if job_mode == "rebuild_empty":
        urls = _broken_urls_for_source(sb, key)
        payload = {
            "source_key": key,
            # max_discover_pages=0 ⇒ discover_done immediately (no listing walk)
            "status": "running" if urls else "completed",
            "since_years": float(since_years) if since_years is not None else 5.0,
            "batch_size": max(1, min(int(batch_size or DEFAULT_BATCH_SIZE), MAX_BATCH_SIZE)),
            "discover_page": 1,
            "max_discover_pages": 0,
            "urls": urls,
            "cursor_idx": 0,
            "discovered": len(urls),
            "ingested": 0,
            "skipped": 0,
            "failed": 0,
            "last_error": None
            if urls
            else "No empty/error URL sources to rebuild for this site.",
            "created_by": created_by,
            "updated_at": _now_iso(),
        }
    else:
        payload = {
            "source_key": key,
            "status": "discovering",
            "since_years": float(since_years) if since_years is not None else 5.0,
            "batch_size": max(1, min(int(batch_size or DEFAULT_BATCH_SIZE), MAX_BATCH_SIZE)),
            "discover_page": 1,
            "max_discover_pages": max(1, min(int(max_discover_pages or 250), 400)),
            "urls": [],
            "cursor_idx": 0,
            "discovered": 0,
            "ingested": 0,
            "skipped": 0,
            "failed": 0,
            "last_error": None,
            "created_by": created_by,
            "updated_at": _now_iso(),
        }
    try:
        res = sb.table("rag_seed_jobs").insert(payload).execute()
    except Exception as e:
        raise RuntimeError(
            "rag_seed_jobs table missing or not writable. "
            "Run backend/migrations/rag_seed_jobs.sql in Supabase, then retry. "
            f"Detail: {e}"
        ) from e
    if not res.data:
        raise RuntimeError("Failed to create seed job")
    return res.data[0]


def get_seed_job(sb, job_id: str) -> Optional[dict[str, Any]]:
    res = sb.table("rag_seed_jobs").select("*").eq("id", job_id).limit(1).execute()
    return (res.data or [None])[0]


def list_seed_jobs(sb, *, limit: int = 20) -> list[dict[str, Any]]:
    res = (
        sb.table("rag_seed_jobs")
        .select("*")
        .order("created_at", desc=True)
        .limit(max(1, min(int(limit or 20), 50)))
        .execute()
    )
    return list(res.data or [])


def cancel_seed_job(sb, job_id: str) -> dict[str, Any]:
    row = get_seed_job(sb, job_id)
    if not row:
        raise ValueError("Job not found")
    if row.get("status") in ("completed", "failed", "cancelled"):
        return row
    res = (
        sb.table("rag_seed_jobs")
        .update({"status": "cancelled", "updated_at": _now_iso()})
        .eq("id", job_id)
        .execute()
    )
    return (res.data or [row])[0]


def _save(sb, job_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    patch = {**patch, "updated_at": _now_iso()}
    res = sb.table("rag_seed_jobs").update(patch).eq("id", job_id).execute()
    if res.data:
        return res.data[0]
    row = get_seed_job(sb, job_id)
    if not row:
        raise RuntimeError("Job disappeared while updating")
    return row


def _tick_discover_babyspace(sb, row: dict[str, Any]) -> dict[str, Any]:
    try:
        from .babyspace_feed import fetch_listing_html, parse_listing
        from .url_acquire import normalize_url
    except ImportError:
        from babyspace_feed import fetch_listing_html, parse_listing
        from url_acquire import normalize_url

    job_id = row["id"]
    page = int(row.get("discover_page") or 1)
    max_pages = int(row.get("max_discover_pages") or 250)
    since_years = row.get("since_years")
    urls = list(row.get("urls") or [])
    known = {u.split("?")[0] for u in urls}
    ready = _ready_origins_for_source(sb, row["source_key"])
    known |= ready
    cursor = int(row.get("cursor_idx") or 0)

    cutoff = None
    if since_years is not None and float(since_years) > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=int(365.25 * float(since_years)))

    end_page = min(page + DISCOVER_PAGES_PER_TICK - 1, max_pages)
    added = 0
    dated_total = 0
    dated_old = 0
    empty_pages = 0

    for p in range(page, end_page + 1):
        path = "/el/articles" if p <= 1 else f"/el/articles?page={p}&per=30"
        try:
            items = parse_listing(fetch_listing_html(path))
        except Exception as e:
            return _save(
                sb,
                job_id,
                {
                    "status": "failed",
                    "last_error": f"Listing fetch failed on page {p}: {e}"[:800],
                },
            )
        if not items:
            empty_pages += 1
            continue
        empty_pages = 0
        for it in items:
            pub = it.pub_date
            if pub is not None:
                if pub.tzinfo is None:
                    pub = pub.replace(tzinfo=timezone.utc)
                else:
                    pub = pub.astimezone(timezone.utc)
                dated_total += 1
                if cutoff is not None and pub < cutoff:
                    dated_old += 1
                    continue
            try:
                u = normalize_url(it.link)
            except ValueError:
                continue
            key = u.split("?")[0]
            if key in known:
                continue
            known.add(key)
            urls.append(u)
            added += 1

    hit_cutoff = bool(cutoff is not None and dated_total > 0 and dated_old >= dated_total)
    # Pagination dead-end (WAF / empty) — stop discovering rather than spinning to max_pages
    stalled = empty_pages >= DISCOVER_PAGES_PER_TICK

    next_page = end_page + 1
    discover_done = next_page > max_pages or hit_cutoff or stalled
    pending = len(urls) > cursor

    patch: dict[str, Any] = {
        "urls": urls,
        "discovered": len(urls),
        "discover_page": (max_pages + 1) if discover_done else next_page,
    }
    if stalled and not pending and added == 0 and page == 1:
        patch["status"] = "failed"
        patch["last_error"] = (
            "Babyspace listing returned no articles. Check outbound HTTPS from the server."
        )
    elif pending:
        # Ingest newly queued URLs before walking older listing pages — library count moves.
        patch["status"] = "running"
    elif discover_done:
        patch["status"] = "completed"
    else:
        patch["status"] = "discovering"

    if hit_cutoff and not patch.get("last_error"):
        patch["last_error"] = None
    if stalled and patch["status"] != "failed":
        # Soft note only; keep going if we already have URLs to ingest
        pass

    return _save(sb, job_id, patch)


def _tick_discover_myparenthood(sb, row: dict[str, Any]) -> dict[str, Any]:
    try:
        from .url_acquire import discover_source_urls, normalize_url
    except ImportError:
        from url_acquire import discover_source_urls, normalize_url

    job_id = row["id"]
    ready = _ready_origins_for_source(sb, "myparenthood")
    found = discover_source_urls(
        base_url="https://myparenthood.gr/blog/",
        sitemap_url="https://myparenthood.gr/post-sitemap.xml",
        source_key="myparenthood",
        max_urls=500,
    )
    urls: list[str] = []
    seen: set[str] = set()
    for raw in found:
        try:
            u = normalize_url(raw)
        except ValueError:
            continue
        key = u.split("?")[0]
        if key in ready or key in seen:
            continue
        seen.add(key)
        urls.append(u)
    max_pages = int(row.get("max_discover_pages") or 250)
    return _save(
        sb,
        job_id,
        {
            "urls": urls,
            "discovered": len(urls),
            "discover_page": max_pages + 1,
            "status": "running" if urls else "completed",
        },
    )


def _is_dead_url_error(exc: BaseException) -> bool:
    """Broken listing links (404/410) should not fail the whole seed job."""
    msg = str(exc).lower()
    if "404" in msg or "410" in msg or "not found" in msg:
        return True
    try:
        import requests

        if isinstance(exc, requests.exceptions.HTTPError):
            code = getattr(getattr(exc, "response", None), "status_code", None)
            if code in (404, 410, 451):
                return True
    except Exception:
        pass
    return False


def _tick_ingest(sb, row: dict[str, Any]) -> dict[str, Any]:
    try:
        from .rag_ingest import create_or_update_url_source_and_ingest, url_already_ingested
    except ImportError:
        from rag_ingest import create_or_update_url_source_and_ingest, url_already_ingested

    job_id = row["id"]
    urls = list(row.get("urls") or [])
    idx = int(row.get("cursor_idx") or 0)
    batch = max(1, min(int(row.get("batch_size") or DEFAULT_BATCH_SIZE), MAX_BATCH_SIZE))
    ingested = int(row.get("ingested") or 0)
    skipped = int(row.get("skipped") or 0)
    failed = int(row.get("failed") or 0)
    last_error = row.get("last_error")
    max_pages = int(row.get("max_discover_pages") or 250)
    discover_page = int(row.get("discover_page") or 1)
    discover_done = discover_page > max_pages
    # rebuild_empty jobs set max_discover_pages=0 — always re-fetch queued URLs.
    force_rebuild = max_pages == 0

    end = min(idx + batch, len(urls))
    for u in urls[idx:end]:
        if not force_rebuild and url_already_ingested(sb, u):
            skipped += 1
            continue
        try:
            create_or_update_url_source_and_ingest(
                sb,
                url=u,
                source_key=row.get("source_key"),
                language="el",
            )
            ingested += 1
            # Clear sticky soft-errors once a URL succeeds
            if last_error and _is_dead_url_error(Exception(last_error)):
                last_error = None
        except Exception as e:
            if _is_dead_url_error(e):
                skipped += 1
                last_error = f"Skipped dead link (404/410): {u}"[:500]
            else:
                failed += 1
                last_error = str(e)[:500]

    patch: dict[str, Any] = {
        "cursor_idx": end,
        "ingested": ingested,
        "skipped": skipped,
        "failed": failed,
        "last_error": last_error,
    }
    if end < len(urls):
        patch["status"] = "running"
    elif not discover_done and (row.get("source_key") == "babyspace"):
        # Queue drained — walk older listing pages for the rest of the year window.
        patch["status"] = "discovering"
    else:
        patch["status"] = "completed"
    return _save(sb, job_id, patch)


def tick_seed_job(sb, job_id: str) -> dict[str, Any]:
    """Advance a seed job by one small safe step (discover pages or ingest a few URLs)."""
    row = get_seed_job(sb, job_id)
    if not row:
        raise ValueError("Job not found")
    status = (row.get("status") or "").lower()
    if status in ("completed", "failed", "cancelled"):
        return row
    try:
        if status in ("queued", "discovering"):
            if row.get("source_key") == "myparenthood":
                return _tick_discover_myparenthood(sb, row)
            return _tick_discover_babyspace(sb, row)
        if status == "running":
            return _tick_ingest(sb, row)
        return row
    except Exception as e:
        return _save(
            sb,
            job_id,
            {"status": "failed", "last_error": str(e)[:800]},
        )
