"""
RAG retrieval helpers.

Primary path: Supabase RPC match_chunks (fast when an ANN index exists).
Fallback: keyword candidate fetch + local cosine re-rank — used when the RPC
times out on large 3072-d corpora without an index (common after multi-site ingest).
"""

from __future__ import annotations

import json
import math
import os
import re
import time
from typing import Any, Optional

import requests

_RAG_STOPWORDS = {
    "και",
    "για",
    "από",
    "απο",
    "την",
    "το",
    "τα",
    "η",
    "ο",
    "οι",
    "να",
    "με",
    "σε",
    "του",
    "της",
    "των",
    "είναι",
    "ειναι",
    "που",
    "πως",
    "πώς",
    "τι",
    "θα",
    "αν",
    "δεν",
    "ένα",
    "ενα",
    "μια",
    "μου",
    "σου",
    "μας",
    "σας",
    "στο",
    "στη",
    "στην",
    "στα",
    "στις",
    "ότι",
    "οτι",
    "ως",
    "ή",
    "η",
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "what",
    "how",
    "when",
    "why",
    "are",
    "is",
    "was",
    "can",
    "should",
    "about",
    "please",
    "into",
    "your",
    "have",
    "has",
}

_TERM_RE = re.compile(r"[A-Za-zΑ-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊΐϋΰ0-9]{3,}", re.UNICODE)


def parse_embedding(raw: Any) -> Optional[list[float]]:
    if raw is None:
        return None
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except Exception:
            return None
        return parsed if isinstance(parsed, list) else None
    return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    n = min(len(a), len(b))
    if n <= 0:
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for i in range(n):
        x = float(a[i])
        y = float(b[i])
        dot += x * y
        na += x * x
        nb += y * y
    if na <= 0.0 or nb <= 0.0:
        return 0.0
    return dot / math.sqrt(na * nb)


def query_terms(query: str, *, max_terms: int = 8) -> list[str]:
    terms: list[str] = []
    for match in _TERM_RE.findall(query or ""):
        low = match.lower()
        if low in _RAG_STOPWORDS:
            continue
        if low not in terms:
            terms.append(low)
        if len(terms) >= max_terms:
            break
    if not terms and (query or "").strip():
        snippet = (query or "").strip()[:48]
        if snippet:
            terms = [snippet]
    return terms


def match_chunks_rpc(
    *,
    supabase_url: str,
    service_key: str,
    query_embedding: list[float],
    match_count: int,
    match_threshold: float,
    timeout: float = 2.5,
) -> list[dict]:
    """Call match_chunks with a tight HTTP timeout so chat can fall back quickly."""
    url = (supabase_url or "").rstrip("/") + "/rest/v1/rpc/match_chunks"
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    payload = {
        "query_embedding": query_embedding,
        "match_count": match_count,
        "match_threshold": match_threshold,
    }
    res = requests.post(url, headers=headers, json=payload, timeout=timeout)
    res.raise_for_status()
    data = res.json()
    return data if isinstance(data, list) else []


_SOURCE_HINTS = (
    (("eody", "εοδυ", "εθνικ"), "eody-gov-gr"),
    (("babyspace", "μπέιμπισπέις", "μπεημπισπεης"), "babyspace"),
    (("myparenthood", "parenthood", "μαιπάρεντ", "μαιπαρεντ"), "myparenthood"),
)


def hinted_source_keys(query: str) -> list[str]:
    q = (query or "").lower()
    keys: list[str] = []
    for needles, source_key in _SOURCE_HINTS:
        if any(n in q for n in needles):
            keys.append(source_key)
    return keys


def fetch_keyword_candidates(
    sb,
    terms: list[str],
    *,
    per_term: int = 28,
    max_total: int = 80,
    prefer_source_keys: Optional[list[str]] = None,
) -> list[dict]:
    """
    Two-phase candidate pull (all source_keys):
    1) content-only ilike (fast)
    2) load embeddings only for the best / preferred rows
    """
    if not terms:
        return []

    hit_counts: dict[str, int] = {}
    light_rows: dict[str, dict] = {}
    prefer = set(prefer_source_keys or [])

    for term in terms:
        pattern = f"%{term}%"
        try:
            rows = (
                sb.table("rag_chunks")
                .select("id,source_id,content,metadata")
                .ilike("content", pattern)
                .limit(per_term)
                .execute()
                .data
                or []
            )
        except Exception:
            continue
        for row in rows:
            rid = row.get("id")
            if not rid:
                continue
            hit_counts[rid] = hit_counts.get(rid, 0) + 1
            light_rows[rid] = row

    if not light_rows:
        return []

    def _sort_key(rid: str) -> tuple:
        meta = light_rows[rid].get("metadata") or {}
        sk = meta.get("source_key") or ""
        preferred = 1 if sk in prefer else 0
        return (-preferred, -hit_counts.get(rid, 0))

    ordered_ids = sorted(light_rows.keys(), key=_sort_key)[:max_total]
    # Cap embedding downloads — 3072-d payloads are heavy.
    embed_ids = ordered_ids[: min(48, len(ordered_ids))]
    if not embed_ids:
        return []

    try:
        heavy = (
            sb.table("rag_chunks")
            .select("id,source_id,content,metadata,embedding")
            .in_("id", embed_ids)
            .execute()
            .data
            or []
        )
    except Exception:
        return []
    return heavy


def rank_candidates(
    candidates: list[dict],
    query_embedding: list[float],
    *,
    top_k: int,
    threshold: float,
    prefer_source_keys: Optional[list[str]] = None,
    terms: Optional[list[str]] = None,
) -> list[dict]:
    prefer = set(prefer_source_keys or [])
    terms_l = [t.lower() for t in (terms or [])]
    scored: list[tuple[float, dict]] = []
    for row in candidates:
        emb = parse_embedding(row.get("embedding"))
        if not emb:
            continue
        sim = cosine_similarity(query_embedding, emb)
        meta = row.get("metadata") or {}
        sk = meta.get("source_key") or ""
        content_l = (row.get("content") or "").lower()
        term_hits = sum(1 for t in terms_l if t in content_l)
        boost = 0.0
        if sk in prefer:
            boost += 0.04
        boost += min(0.03, 0.01 * term_hits)
        adj = sim + boost
        if sim < threshold and sk not in prefer:
            continue
        if sk in prefer and sim < max(0.12, threshold - 0.08):
            continue
        scored.append(
            (
                adj,
                {
                    "id": row.get("id"),
                    "source_id": row.get("source_id"),
                    "content": row.get("content") or "",
                    "metadata": meta,
                    "similarity": sim,
                },
            )
        )
    scored.sort(key=lambda item: item[0], reverse=True)

    # Light source diversity: keep top hit per source_key first, then fill.
    out: list[dict] = []
    seen_keys: set[str] = set()
    rest: list[dict] = []
    for _, row in scored:
        sk = (row.get("metadata") or {}).get("source_key") or row.get("source_id") or ""
        if sk and sk not in seen_keys and len(out) < top_k:
            out.append(row)
            seen_keys.add(str(sk))
        else:
            rest.append(row)
    for row in rest:
        if len(out) >= top_k:
            break
        out.append(row)
    return out


def retrieve_hybrid(
    sb,
    *,
    supabase_url: str,
    service_key: str,
    query: str,
    query_embedding: list[float],
    top_k: int = 6,
    threshold: float = 0.22,
    rpc_timeout: float = 1.2,
    try_rpc: bool = False,
) -> tuple[list[dict], dict]:
    """
    Keyword candidates + local cosine across all sources.

    Optionally tries match_chunks first (enable after HNSW migration:
    RAG_USE_MATCH_RPC=1). Until then RPC statement-timeouts waste chat budget.
    """
    meta: dict[str, Any] = {
        "path": None,
        "rpc_ms": 0.0,
        "fallback_ms": 0.0,
        "candidates": 0,
        "error": None,
    }

    use_rpc = try_rpc or (os.getenv("RAG_USE_MATCH_RPC") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if use_rpc and supabase_url and service_key:
        t0 = time.perf_counter()
        try:
            rows = match_chunks_rpc(
                supabase_url=supabase_url,
                service_key=service_key,
                query_embedding=query_embedding,
                match_count=top_k,
                match_threshold=threshold,
                timeout=rpc_timeout,
            )
            meta["rpc_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            filtered = [r for r in rows if (r.get("content") or "").strip()]
            if filtered:
                meta["path"] = "match_chunks"
                return filtered, meta
        except Exception as e:
            meta["rpc_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            meta["error"] = str(e)[:200]

    t1 = time.perf_counter()
    terms = query_terms(query)
    prefer = hinted_source_keys(query)
    per_term = max(24, min(40, 100 // max(len(terms), 1)))
    candidates = fetch_keyword_candidates(
        sb,
        terms,
        per_term=per_term,
        max_total=80,
        prefer_source_keys=prefer,
    )
    meta["candidates"] = len(candidates)
    ranked = rank_candidates(
        candidates,
        query_embedding,
        top_k=top_k,
        threshold=threshold,
        prefer_source_keys=prefer,
        terms=terms,
    )
    if not ranked and candidates:
        ranked = rank_candidates(
            candidates,
            query_embedding,
            top_k=top_k,
            threshold=max(0.12, threshold - 0.1),
            prefer_source_keys=prefer,
            terms=terms,
        )
    meta["fallback_ms"] = round((time.perf_counter() - t1) * 1000, 1)
    meta["path"] = "keyword_cosine"
    return ranked, meta
