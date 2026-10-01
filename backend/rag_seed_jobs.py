"""Background-friendly RAG seed jobs (small ticks so Vercel does not time out)."""
from __future__ import annotations

import re
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


def _slug_source_key(raw: str) -> str:
    key = (raw or "").strip().lower()[:40]
    return key


def slug_from_filename(filename: str) -> str:
    """Stable source_key for an uploaded document (same path as a website slug)."""
    import hashlib
    import os
    import re

    base = os.path.basename(filename or "").strip() or "document"
    stem = os.path.splitext(base)[0]
    slug = re.sub(r"[^a-z0-9]+", "-", (stem or "").lower()).strip("-")
    if not slug:
        # Greek / non-latin filenames still need a stable key (never "file").
        digest = hashlib.sha1(base.encode("utf-8", errors="ignore")).hexdigest()[:10]
        slug = f"doc-{digest}"
    return slug[:40]


# Initial collections — same shape as anything added later via admin.
INITIAL_KNOWLEDGE_SOURCES: list[dict[str, Any]] = [
    {
        "source_key": "babyspace",
        "name": "Babyspace",
        "source_type": "website",
        "language": "el",
        "base_url": "https://www.babyspace.gr/",
        "metadata": {
            "discover": "listing_pages",
            "since_years": 5,
            "max_urls": 2000,
            "max_discover_pages": 250,
            "seed": True,
        },
    },
    {
        "source_key": "myparenthood",
        "name": "My Parenthood",
        "source_type": "website",
        "language": "el",
        "base_url": "https://myparenthood.gr/blog/",
        "metadata": {
            "discover": "sitemap",
            "sitemap": "https://myparenthood.gr/post-sitemap.xml",
            "max_urls": 80,
            "seed": True,
        },
    },
    {
        "source_key": "eody-gov-gr",
        "name": "EODY",
        "source_type": "website",
        "language": "el",
        "base_url": "https://eody.gov.gr/el/",
        "metadata": {
            "discover": "rss",
            "rss": "https://eody.gov.gr/el/?format=feed&type=rss",
            "max_urls": 50,
            "seed": True,
        },
    },
]


def get_knowledge_source(sb, source_key: str) -> Optional[dict[str, Any]]:
    key = _slug_source_key(source_key)
    if not key:
        return None
    try:
        res = (
            sb.table("knowledge_sources")
            .select("source_key,name,source_type,language,base_url,enabled,metadata")
            .eq("source_key", key)
            .limit(1)
            .execute()
        )
    except Exception:
        return None
    return (res.data or [None])[0]


def upsert_knowledge_source(
    sb,
    *,
    source_key: str,
    name: str,
    base_url: Optional[str] = None,
    source_type: str = "website",
    language: str = "el",
    sitemap_url: Optional[str] = None,
    rss_url: Optional[str] = None,
    max_urls: int = 50,
    discover: Optional[str] = None,
    since_years: Optional[float] = None,
    max_discover_pages: Optional[int] = None,
    metadata_extra: Optional[dict[str, Any]] = None,
    merge_existing: bool = True,
) -> Optional[dict[str, Any]]:
    """Register any source (website or file) so it appears under Site Sync."""
    key = _slug_source_key(source_key)
    if not key:
        return None
    stype = (source_type or "website").strip().lower()
    if stype not in ("website", "url", "file", "collection"):
        stype = "website"
    if stype == "website" and not (base_url or "").strip():
        return None

    existing = get_knowledge_source(sb, key) if merge_existing else None
    meta: dict[str, Any] = {}
    if existing and isinstance(existing.get("metadata"), dict):
        meta.update(existing["metadata"])
    meta["max_urls"] = max(1, min(int(max_urls or meta.get("max_urls") or 50), 2000))
    if sitemap_url:
        meta["sitemap"] = sitemap_url
    if rss_url:
        meta["rss"] = rss_url
    if discover:
        meta["discover"] = discover
    if since_years is not None:
        meta["since_years"] = float(since_years)
    if max_discover_pages is not None:
        meta["max_discover_pages"] = int(max_discover_pages)
    if metadata_extra:
        meta.update(metadata_extra)

    payload = {
        "source_key": key,
        "name": (name or key)[:120],
        "source_type": stype,
        "language": (language or "el")[:12],
        "base_url": (base_url or "").strip() or None,
        "enabled": True,
        "metadata": meta,
        "updated_at": _now_iso(),
    }
    try:
        res = sb.table("knowledge_sources").upsert(payload, on_conflict="source_key").execute()
        return (res.data or [payload])[0]
    except Exception:
        # Table may be missing in older envs — Site Sync still lists from rag_sources.
        return None


def ensure_initial_knowledge_sources(sb) -> None:
    """Babyspace / My Parenthood are just the first registered websites."""
    for src in INITIAL_KNOWLEDGE_SOURCES:
        key = src["source_key"]
        existing = get_knowledge_source(sb, key)
        meta = dict(src.get("metadata") or {})
        if existing:
            # Backfill discover metadata on older rows without rewriting custom fields.
            em = existing.get("metadata") if isinstance(existing.get("metadata"), dict) else {}
            if em.get("discover") and existing.get("base_url"):
                continue
        upsert_knowledge_source(
            sb,
            source_key=key,
            name=src["name"],
            base_url=src.get("base_url"),
            source_type=src.get("source_type") or "website",
            language=src.get("language") or "el",
            sitemap_url=meta.get("sitemap"),
            rss_url=meta.get("rss"),
            max_urls=int(meta.get("max_urls") or 50),
            discover=meta.get("discover"),
            since_years=meta.get("since_years"),
            max_discover_pages=meta.get("max_discover_pages"),
            metadata_extra={"seed": True},
            merge_existing=True,
        )


def _discover_mode(ks: Optional[dict[str, Any]], source_key: str = "") -> str:
    """How Sync discovers new pages — from registry metadata, not hardcoded keys."""
    meta = (ks or {}).get("metadata") if isinstance((ks or {}).get("metadata"), dict) else {}
    mode = str(meta.get("discover") or "").strip().lower()
    if mode in ("listing_pages", "sitemap", "rss", "crawl", "none"):
        return mode
    key = _slug_source_key(source_key or (ks or {}).get("source_key") or "")
    # Backward compat for rows seeded before discover metadata existed.
    if key == "babyspace":
        return "listing_pages"
    if meta.get("sitemap") or key == "myparenthood":
        return "sitemap"
    if meta.get("rss"):
        return "rss"
    return "crawl"


def list_sync_sites(sb) -> list[dict[str, Any]]:
    """All registered knowledge sources for the admin Site Sync panel."""
    ensure_initial_knowledge_sources(sb)
    out: list[dict[str, Any]] = []
    try:
        res = (
            sb.table("knowledge_sources")
            .select("source_key,name,source_type,base_url,enabled,metadata,language")
            .eq("enabled", True)
            .order("name")
            .execute()
        )
        for row in res.data or []:
            key = (row.get("source_key") or "").strip().lower()
            if not key or key in ("file", "other"):
                continue
            stype = (row.get("source_type") or "website").strip().lower()
            meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
            base = (row.get("base_url") or "").strip()
            if stype == "file":
                filename = meta.get("filename") or key
                blurb = f"Uploaded document ({filename}). Re-upload from Library if broken."
            elif base:
                blurb = (
                    f"{base} — Sync discovers additions; "
                    "Fix broken re-ingests empty/error rows."
                )
            else:
                blurb = "Registered source. Sync discovers additions; Fix broken re-ingests failures."
            since = meta.get("since_years")
            out.append(
                {
                    "key": key,
                    "name": row.get("name") or key,
                    "source_type": stype,
                    "base_url": base or None,
                    "blurb": blurb,
                    "since_years": float(since) if since is not None else None,
                    "discover": _discover_mode(row, key),
                    "sitemap_url": meta.get("sitemap"),
                    "rss_url": meta.get("rss"),
                    "max_urls": meta.get("max_urls") or 50,
                    "can_sync": stype == "website",
                }
            )
    except Exception:
        out = []
    return out


def _base_url_for_source(sb, source_key: str) -> Optional[str]:
    """Fallback base URL from an existing ingested page when knowledge_sources is missing."""
    from urllib.parse import urlparse

    key = _slug_source_key(source_key)
    rows: list[dict[str, Any]] = []
    try:
        res = (
            sb.table("rag_sources")
            .select("origin,source_url,source_key,title")
            .eq("source_key", key)
            .limit(8)
            .execute()
        )
        rows = list(res.data or [])
    except Exception:
        rows = []

    # Legacy uploads / seeds may lack source_key — match by host or filename slug.
    if not rows:
        try:
            res = (
                sb.table("rag_sources")
                .select("origin,source_url,source_key,title")
                .limit(400)
                .execute()
            )
            for row in res.data or []:
                sk = (row.get("source_key") or "").strip().lower()
                if sk == key:
                    rows.append(row)
                    continue
                raw = (row.get("origin") or row.get("source_url") or "").strip()
                if not raw:
                    continue
                if raw.startswith("http"):
                    try:
                        host = urlparse(raw).netloc.replace("www.", "").lower()
                        host_slug = re.sub(r"[^a-z0-9]+", "-", host).strip("-")
                        if host_slug == key or host.replace(".", "-") == key:
                            rows.append(row)
                    except Exception:
                        pass
                elif slug_from_filename(raw) == key:
                    rows.append(row)
        except Exception:
            pass

    for row in rows:
        raw = (row.get("origin") or row.get("source_url") or "").strip()
        if not raw.startswith("http"):
            continue
        try:
            p = urlparse(raw)
            if p.scheme and p.netloc:
                return f"{p.scheme}://{p.netloc}/"
        except Exception:
            continue
    return None


def _display_name_for_source(sb, source_key: str, fallback: str) -> str:
    """Prefer a human title from rag_sources when registering a library-only source."""
    key = _slug_source_key(source_key)
    try:
        res = (
            sb.table("rag_sources")
            .select("title,origin,source_key")
            .eq("source_key", key)
            .limit(1)
            .execute()
        )
        row = (res.data or [None])[0]
        if row and (row.get("title") or "").strip():
            return str(row["title"]).strip()[:120]
    except Exception:
        pass
    try:
        res = (
            sb.table("rag_sources")
            .select("title,origin,source_key")
            .is_("source_key", "null")
            .limit(200)
            .execute()
        )
        for row in res.data or []:
            origin = (row.get("origin") or "").strip()
            if origin and slug_from_filename(origin) == key:
                title = (row.get("title") or "").strip()
                return (title or origin)[:120]
    except Exception:
        pass
    return fallback


def create_seed_job(
    sb,
    *,
    source_key: str,
    since_years: Optional[float] = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
    max_discover_pages: int = 250,
    created_by: Optional[str] = None,
    mode: str = "add_new",
) -> dict[str, Any]:
    key = _slug_source_key(source_key)
    if not key:
        raise ValueError("source_key is required")
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

    ks = get_knowledge_source(sb, key) or {}
    stype = (ks.get("source_type") or "website").strip().lower()
    if stype == "file":
        raise ValueError(
            f"'{key}' is a file source — re-upload it from Add a source if it needs fixing."
        )

    meta = ks.get("metadata") if isinstance(ks.get("metadata"), dict) else {}
    discover = _discover_mode(ks, key)
    years = (
        float(since_years)
        if since_years is not None
        else float(meta["since_years"])
        if meta.get("since_years") is not None
        else (5.0 if discover == "listing_pages" else 5.0)
    )

    # Paginated listing walk (Babyspace-style) — same registry, different discover mode.
    if discover == "listing_pages":
        pages = int(meta.get("max_discover_pages") or max_discover_pages or 250)
        payload = {
            "source_key": key,
            "status": "discovering",
            "since_years": years,
            "batch_size": max(1, min(int(batch_size or DEFAULT_BATCH_SIZE), MAX_BATCH_SIZE)),
            "discover_page": 1,
            "max_discover_pages": max(1, min(pages, 400)),
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

    # Sitemap / RSS / crawl — one-shot discover then prepared ingest (same as Add website).
    base = (ks.get("base_url") or "").strip() or (_base_url_for_source(sb, key) or "")
    if not base:
        raise ValueError(
            f"No crawl config for '{key}'. Add it again under Add a source "
            "(base URL / RSS / sitemap), then Sync will work."
        )
    try:
        from .url_acquire import discover_source_urls
    except ImportError:
        from url_acquire import discover_source_urls

    max_urls = max(1, min(int(meta.get("max_urls") or 50), 2000))
    urls = discover_source_urls(
        base_url=base,
        sitemap_url=(meta.get("sitemap") or None),
        rss_url=(meta.get("rss") or None),
        source_key=key,
        max_urls=max_urls,
        since_years=years if discover == "listing_pages" else None,
    )
    if not urls:
        raise ValueError("No pages discovered for this site.")
    return create_prepared_seed_job(
        sb,
        source_key=key,
        urls=urls,
        created_by=created_by,
        batch_size=batch_size,
    )


def create_prepared_seed_job(
    sb,
    *,
    source_key: str,
    urls: list[str],
    created_by: Optional[str] = None,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> dict[str, Any]:
    """Queue an already-discovered URL list and ingest it in small ticks.

    discover_page > max_discover_pages marks discovery finished without the
    rebuild_empty shortcut (that shortcut is max_discover_pages == 0).
    """
    key = (source_key or "").strip().lower()[:40]
    if not key:
        raise ValueError("source_key is required")
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in urls:
        u = (raw or "").strip()
        if not u.startswith("http") or u in seen:
            continue
        seen.add(u)
        cleaned.append(u)
    if not cleaned:
        raise ValueError("No pages to ingest")
    payload = {
        "source_key": key,
        "status": "running",
        "since_years": None,
        "batch_size": max(1, min(int(batch_size or DEFAULT_BATCH_SIZE), MAX_BATCH_SIZE)),
        "discover_page": 2,
        "max_discover_pages": 1,
        "urls": cleaned,
        "cursor_idx": 0,
        "discovered": len(cleaned),
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


_TERMINAL_STATUSES = ("completed", "failed", "cancelled")
_ACTIVE_STATUSES = ("queued", "discovering", "running")


def cancel_seed_job(sb, job_id: str) -> dict[str, Any]:
    row = get_seed_job(sb, job_id)
    if not row:
        raise ValueError("Job not found")
    if (row.get("status") or "").lower() in _TERMINAL_STATUSES:
        return row
    res = (
        sb.table("rag_seed_jobs")
        .update({"status": "cancelled", "updated_at": _now_iso()})
        .eq("id", job_id)
        .in_("status", list(_ACTIVE_STATUSES))
        .execute()
    )
    if res.data:
        return res.data[0]
    # Already finished or cancelled by a concurrent request.
    return get_seed_job(sb, job_id) or row


def _save(sb, job_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    """Persist a tick patch only while the job is still active.

    Cancel must win races: an in-flight tick must not overwrite status=cancelled
    with running/discovering after the user hits Cancel.
    """
    patch = {**patch, "updated_at": _now_iso()}
    res = (
        sb.table("rag_seed_jobs")
        .update(patch)
        .eq("id", job_id)
        .in_("status", list(_ACTIVE_STATUSES))
        .execute()
    )
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
    """One-shot sitemap/RSS discover for legacy discovering jobs."""
    try:
        from .url_acquire import discover_source_urls, normalize_url
    except ImportError:
        from url_acquire import discover_source_urls, normalize_url

    job_id = row["id"]
    source_key = (row.get("source_key") or "myparenthood").strip().lower()
    ks = get_knowledge_source(sb, source_key) or {}
    meta = ks.get("metadata") if isinstance(ks.get("metadata"), dict) else {}
    base = (ks.get("base_url") or "").strip() or "https://myparenthood.gr/blog/"
    sitemap = meta.get("sitemap") or (
        "https://myparenthood.gr/post-sitemap.xml" if source_key == "myparenthood" else None
    )
    ready = _ready_origins_for_source(sb, source_key)
    found = discover_source_urls(
        base_url=base,
        sitemap_url=sitemap,
        rss_url=meta.get("rss"),
        source_key=source_key,
        max_urls=int(meta.get("max_urls") or 500),
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
    elif not discover_done:
        ks = get_knowledge_source(sb, row.get("source_key") or "")
        if _discover_mode(ks, row.get("source_key") or "") == "listing_pages":
            # Queue drained — walk older listing pages for the rest of the year window.
            patch["status"] = "discovering"
        else:
            patch["status"] = "completed"
    else:
        patch["status"] = "completed"
    return _save(sb, job_id, patch)


def tick_seed_job(sb, job_id: str) -> dict[str, Any]:
    """Advance a seed job by one small safe step (discover pages or ingest a few URLs)."""
    row = get_seed_job(sb, job_id)
    if not row:
        raise ValueError("Job not found")
    status = (row.get("status") or "").lower()
    if status in _TERMINAL_STATUSES:
        return row
    try:
        if status in ("queued", "discovering"):
            key = (row.get("source_key") or "").strip().lower()
            ks = get_knowledge_source(sb, key)
            mode = _discover_mode(ks, key)
            if mode == "listing_pages":
                return _tick_discover_babyspace(sb, row)
            # Legacy in-flight sitemap jobs (pre-unify); new jobs use prepared URL lists.
            return _tick_discover_myparenthood(sb, row)
        if status == "running":
            return _tick_ingest(sb, row)
        return row
    except Exception as e:
        # Don't mark failed if the user already cancelled mid-tick.
        latest = get_seed_job(sb, job_id)
        if latest and (latest.get("status") or "").lower() == "cancelled":
            return latest
        return _save(
            sb,
            job_id,
            {"status": "failed", "last_error": str(e)[:800]},
        )
