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
        return {
            "ok": False,
            "error": str(e),
            **totals,
            "by_source_key": {},
            "sites": [],
            "active_job": None,
        }

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
        origin_l = (origin or row.get("source_url") or "").lower()
        stype_l = stype
        if not key:
            if "babyspace.gr" in origin_l:
                key = "babyspace"
            elif "myparenthood.gr" in origin_l:
                key = "myparenthood"
            elif "eody.gov.gr" in origin_l:
                key = "eody-gov-gr"
            elif "moh.gov.gr" in origin_l:
                key = "moh-gov-gr"
            elif "insp.gov.ro" in origin_l:
                key = "insp-gov-ro"
            elif "who.int" in origin_l:
                key = "who-int"
            elif "ms.ro" in origin_l:
                key = "ms-gov-ro"
            elif "babyspace.com.ro" in origin_l:
                key = "babyspace-ro"
            elif stype_l in ("pdf", "text", "markdown", "file") or (
                origin and not origin.startswith("http")
            ):
                # Each uploaded doc is its own registered source (same as websites).
                try:
                    from .rag_seed_jobs import slug_from_filename
                except ImportError:
                    from rag_seed_jobs import slug_from_filename
                key = slug_from_filename(origin) if origin else "other"
            elif origin.startswith("http"):
                from urllib.parse import urlparse
                import re as _re

                try:
                    host = urlparse(origin).netloc.replace("www.", "").lower()
                    key = _re.sub(r"[^a-z0-9]+", "-", host).strip("-")[:40] or "other"
                except Exception:
                    key = "other"
            else:
                key = "other"
        elif key not in (
            "babyspace",
            "myparenthood",
            "eody-gov-gr",
            "moh-gov-gr",
            "insp-gov-ro",
            "who-int",
            "ms-gov-ro",
            "babyspace-ro",
        ):
            if "babyspace.gr" in origin_l:
                key = "babyspace"
            elif "myparenthood.gr" in origin_l:
                key = "myparenthood"
            elif "eody.gov.gr" in origin_l:
                key = "eody-gov-gr"
            elif "moh.gov.gr" in origin_l:
                key = "moh-gov-gr"
            elif "insp.gov.ro" in origin_l:
                key = "insp-gov-ro"
            elif "who.int" in origin_l:
                key = "who-int"
            elif "ms.ro" in origin_l:
                key = "ms-gov-ro"
            elif "babyspace.com.ro" in origin_l:
                key = "babyspace-ro"
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

    sites: list[dict[str, Any]] = []
    try:
        from .rag_seed_jobs import (
            INITIAL_KNOWLEDGE_SOURCES,
            _base_url_for_source,
            _display_name_for_source,
            list_sync_sites,
            upsert_knowledge_source,
        )
    except ImportError:
        from rag_seed_jobs import (
            INITIAL_KNOWLEDGE_SOURCES,
            _base_url_for_source,
            _display_name_for_source,
            list_sync_sites,
            upsert_knowledge_source,
        )

    # Registry rows (Babyspace / My Parenthood / anything added via admin).
    try:
        sites = list_sync_sites(sb)
    except Exception:
        sites = []

    known = {s["key"] for s in sites}

    # Always surface the initial websites even if knowledge_sources is empty.
    for src in INITIAL_KNOWLEDGE_SOURCES:
        key = src["source_key"]
        if key in known:
            continue
        sites.append(
            {
                "key": key,
                "name": src["name"],
                "source_type": "website",
                "base_url": src.get("base_url"),
                "blurb": f"{src.get('base_url')} — Sync discovers additions; Fix broken re-ingests empty/error rows.",
                "since_years": (src.get("metadata") or {}).get("since_years"),
                "can_sync": True,
            }
        )
        known.add(key)

    # Library collections not yet in the registry (EODY, PDFs, …).
    for key, bucket in sorted(by_key.items()):
        if key in known or key in ("file", "other", ""):
            continue
        if int(bucket.get("sources") or 0) < 1:
            continue
        label = _display_name_for_source(
            sb,
            key,
            key.replace("-", " ").replace("_", " ").strip().title() or key,
        )
        base = _base_url_for_source(sb, key)
        try:
            if base:
                upsert_knowledge_source(
                    sb,
                    source_key=key,
                    name=label,
                    base_url=base,
                    source_type="website",
                )
                stype = "website"
                blurb = (
                    f"{base} — Sync discovers additions; "
                    "Fix broken re-ingests empty/error rows."
                )
                can_sync = True
            else:
                upsert_knowledge_source(
                    sb,
                    source_key=key,
                    name=label,
                    source_type="file",
                    base_url=None,
                    metadata_extra={"filename": key, "seed": True},
                )
                stype = "file"
                blurb = "Uploaded document. Re-upload from Add a source if broken."
                can_sync = False
        except Exception:
            stype = "website" if base else "file"
            blurb = (
                f"{base} — Sync discovers additions; Fix broken re-ingests empty/error rows."
                if base
                else "Uploaded document. Re-upload from Add a source if broken."
            )
            can_sync = bool(base)
        sites.append(
            {
                "key": key,
                "name": label,
                "source_type": stype,
                "base_url": base,
                "blurb": blurb,
                "since_years": None,
                "can_sync": can_sync,
            }
        )
        known.add(key)

    # Websites first (syncable), then files; alphabetical within each — no pinned keys.
    def _site_sort(s: dict[str, Any]) -> tuple:
        st = (s.get("source_type") or "website").lower()
        return (
            0 if st == "website" else 1,
            (s.get("name") or s.get("key") or "").lower(),
        )

    sites.sort(key=_site_sort)

    # Attach live health counts so the admin cards stay accurate.
    for site in sites:
        counts = by_key.get(site["key"]) or {}
        site["sources"] = int(counts.get("sources") or 0)
        site["broken"] = int(counts.get("broken") or 0)
        site["ready"] = int(counts.get("ready") or 0)

    return {
        "ok": True,
        **totals,
        "by_source_key": by_key,
        "sites": sites,
        "active_job": active_job,
        "recent_jobs": recent_jobs[:5],
    }
