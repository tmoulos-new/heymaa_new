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

# Fold Greek tonos so "έχει" / "εχει" share one stopword entry.
_GREEK_ACCENT_MAP = str.maketrans(
    "άέήίόύώϊΐϋΰΆΈΉΊΌΎΏ",
    "αεηιουωιιυυΑΕΗΙΟΥΩ",
)


def _fold_term(s: str) -> str:
    return (s or "").lower().translate(_GREEK_ACCENT_MAP)


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
    # Common Greek verbs / auxiliaries — flood ilike candidates if kept as terms
    # (Babyspace scrapes often uppercase "ΕΧΕΙ" in nav chrome).
    "έχει",
    "εχει",
    "έχω",
    "εχω",
    "έχεις",
    "εχεις",
    "έχουμε",
    "εχουμε",
    "κάνει",
    "κανει",
    "κάνω",
    "κανω",
    "πήγε",
    "πηγε",
    "θέλω",
    "θελω",
    "μπορεί",
    "μπορει",
    "πρέπει",
    "πρεπει",
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
    "had",
    "does",
    "did",
    "been",
}
_RAG_STOPWORDS_FOLDED = {_fold_term(w) for w in _RAG_STOPWORDS}

# When present in the user query, keyword retrieval must prefer chunks that
# also contain these stems — stops child names / filler from dominating.
_TOPIC_ANCHOR_STEMS = (
    "πυρετ",
    "fever",
    "febr",
    "εξανθ",
    "εξάνθ",
    "rash",
    "βηχ",
    "βήχ",
    "cough",
    "εμετ",
    "vomit",
    "διαρρο",
    "διάρρο",
    "diarrh",
    "εμβολ",
    "vaccin",
    "θηλασ",
    "breastfeed",
    "νεογν",
    "newborn",
    "βρεφ",
    "infant",
    "ωτιτιδ",
    "ωτίτιδ",
    "otitis",
    "αλλεργ",
    "allerg",
    "ασθμ",
    "asthma",
    "γριπ",
    "influenz",
    "αντιβιοτ",
    "antibiotic",
    "πονολαιμ",
    "πονόλαιμ",
)

_TERM_RE = re.compile(r"[A-Za-zΑ-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊΐϋΰ0-9]{3,}", re.UNICODE)


def topic_anchors_in_text(text: str) -> list[str]:
    """Return medical/topic stems found in text (accent-folded)."""
    raw = (text or "").lower()
    folded = _fold_term(raw)
    found: list[str] = []
    for stem in _TOPIC_ANCHOR_STEMS:
        stem_l = stem.lower()
        stem_f = _fold_term(stem_l)
        if stem_l in raw or stem_f in folded:
            if stem_f not in found:
                found.append(stem_f)
    return found


def expand_anchors_for_match(anchors: list[str]) -> list[str]:
    """Multilingual stems used when filtering/boosting chunk text."""
    out: list[str] = []
    vowels = set("αεηιουωaeiou")

    def _add(token: str) -> None:
        t = _fold_term(token)
        if len(t) < 4 or t in out:
            return
        out.append(t)
        if len(t) >= 6 and t[-1] in vowels:
            stem = t[:-1]
            if len(stem) >= 4 and stem not in out:
                out.append(stem)

    for a in anchors or []:
        _add(a)
        for variant in _ANCHOR_ILIKE_VARIANTS.get(a, ()):
            _add(variant)
    return out


def _term_match_weight(term: str) -> float:
    """Longer / more specific keyword terms outweigh short names and fillers."""
    t = (term or "").strip()
    if not t:
        return 0.0
    return float(min(12, max(3, len(t)))) / 6.0


# Short stems (πυρετ) are great for ranking filters but often statement-timeout
# on large corpora via ilike. Prefer these concrete variants for SQL fetch.
_ANCHOR_ILIKE_VARIANTS: dict[str, tuple[str, ...]] = {
    "πυρετ": ("πυρετο", "πυρετό", "fever", "febra", "febră", "piretos"),
    "fever": ("fever", "πυρετο", "πυρετό", "febra", "febră"),
    "febr": ("febra", "febră", "fever", "πυρετο"),
    "εξανθ": ("εξάνθημα", "εξανθημα", "rash"),
    "εξάνθ": ("εξάνθημα", "εξανθημα", "rash"),
    "rash": ("rash", "εξάνθημα", "εξανθημα"),
    "βηχ": ("βήχα", "βηχα", "cough"),
    "βήχ": ("βήχα", "βηχα", "cough"),
    "cough": ("cough", "βήχα", "βηχα"),
    "εμβολ": ("εμβόλιο", "εμβολιο", "vaccine", "vaccin"),
    "vaccin": ("vaccine", "vaccination", "εμβόλιο", "εμβολιο"),
    "θηλασ": ("θηλασμό", "θηλασμο", "breastfeed", "breastfeeding"),
    "breastfeed": ("breastfeed", "breastfeeding", "θηλασμό", "θηλασμο"),
    "νεογν": ("νεογέννητο", "νεογεννητο", "newborn"),
    "newborn": ("newborn", "νεογέννητο", "νεογεννητο"),
    "γριπ": ("γρίπη", "γριπη", "influenza", "flu"),
    "influenz": ("influenza", "γρίπη", "γριπη"),
}


def search_terms_for_query(query: str, *, max_terms: int = 8) -> list[str]:
    """
    Keyword terms used for candidate fetch.

    Keeps the user's own terms first, then adds at most a couple of
    cross-language medical variants. Avoids short stems and long variant
    lists — those statement-timeout on large rag_chunks tables.
    """
    terms = query_terms(query, max_terms=max_terms)
    anchors = topic_anchors_in_text(query)
    out: list[str] = []

    def _add(token: str) -> bool:
        low = (token or "").lower().strip()
        if not low or low in out:
            return False
        if len(_fold_term(low)) < 5:
            return False
        out.append(low)
        return True

    for t in terms:
        _add(t)
        if len(out) >= 4:
            return out

    for a in anchors:
        covered = any(a in _fold_term(t) or _fold_term(t) in a for t in out)
        # Always try one cross-language sibling even when covered, so
        # "fever" still finds Greek πυρετό pages (and vice versa).
        added = 0
        for variant in _ANCHOR_ILIKE_VARIANTS.get(a, (a,)):
            vf = _fold_term(variant)
            if covered and (a in vf or vf in a):
                # Same-language duplicate of an existing user term — skip.
                if any(vf in _fold_term(t) or _fold_term(t) in vf for t in out):
                    continue
            if _add(variant):
                added += 1
            if added >= (1 if covered else 2) or len(out) >= 5:
                break
        if len(out) >= 5:
            break
    return out


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
        if low in _RAG_STOPWORDS or _fold_term(low) in _RAG_STOPWORDS_FOLDED:
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
    (("moh", "υπουργείο υγείας", "υπουργειο υγειας", "ministry of health"), "moh-gov-gr"),
    (("babyspace", "μπέιμπισπέις", "μπεημπισπεης"), "babyspace"),
    (("myparenthood", "parenthood", "μαιπάρεντ", "μαιπαρεντ"), "myparenthood"),
    (("who", "world health", "ομσ", "oms"), "who-int"),
    (("insp", "institutul național", "institutul national"), "insp-gov-ro"),
    (("ministerul sănătății", "ministerul sanatatii", "ms.ro"), "ms-gov-ro"),
    (("babyspace.com.ro", "babyspace România", "babyspace romania"), "babyspace-ro"),
)

# Default language per collection when chunk metadata.language is missing.
SOURCE_KEY_LANG: dict[str, str] = {
    "babyspace": "el",
    "myparenthood": "el",
    "eody-gov-gr": "el",
    "eody": "el",
    "moh-gov-gr": "el",
    "insp-gov-ro": "ro",
    "who-int": "en",
    "ms-gov-ro": "ro",
    "babyspace-ro": "ro",
}


def hinted_source_keys(query: str) -> list[str]:
    q = (query or "").lower()
    keys: list[str] = []
    for needles, source_key in _SOURCE_HINTS:
        if any(n in q for n in needles):
            keys.append(source_key)
    return keys


def normalize_prefer_lang(code: Optional[str]) -> str:
    raw = (code or "").strip().lower().replace("_", "-")
    base = raw.split("-")[0] if raw else ""
    if base in {"el", "en", "ro"}:
        return base
    if base in {"gr", "gre"}:
        return "el"
    if base in {"rum", "ron"}:
        return "ro"
    if base in {"eng"}:
        return "en"
    return "en"


def prefer_languages_for_user(user_lang: Optional[str]) -> list[str]:
    """Soft preference order: user's UI/message language, then English as lingua franca."""
    primary = normalize_prefer_lang(user_lang)
    if primary == "en":
        return ["en"]
    return [primary, "en"]


def chunk_language(meta: Optional[dict], *, source_key: str = "") -> str:
    meta = meta if isinstance(meta, dict) else {}
    lang = str(meta.get("language") or "").strip().lower().split("-")[0]
    if lang in {"el", "en", "ro"}:
        return lang
    sk = str(source_key or meta.get("source_key") or "").strip().lower()
    return SOURCE_KEY_LANG.get(sk, "")


def language_boost(chunk_lang: str, prefer_langs: list[str]) -> float:
    """Soft score bump — never a hard filter, so cross-language evidence still surfaces."""
    if not chunk_lang or not prefer_langs:
        return 0.0
    if chunk_lang == prefer_langs[0]:
        return 0.05
    if chunk_lang in prefer_langs:
        return 0.02
    return 0.0


def rerank_by_language(rows: list[dict], prefer_langs: list[str]) -> list[dict]:
    """Stable soft reorder after vector/RPC match (keeps relative order within tiers)."""
    if not rows or not prefer_langs:
        return rows
    primary = prefer_langs[0]

    def tier(row: dict) -> int:
        meta = row.get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        lang = chunk_language(meta, source_key=str(meta.get("source_key") or ""))
        if lang == primary:
            return 0
        if lang in prefer_langs:
            return 1
        return 2

    indexed = list(enumerate(rows))
    indexed.sort(key=lambda item: (tier(item[1]), item[0]))
    return [row for _, row in indexed]


def _title_query_variants(term: str) -> list[str]:
    """
    Build accent-tolerant title patterns.

    Users often omit Greek tonos ("πυρετο") while titles store "πυρετό".
    A short stem (πυρετ) matches both and is cheap on rag_sources (~3k rows).
    """
    raw = (term or "").strip().lower()
    if not raw:
        return []
    folded = _fold_term(raw)
    out: list[str] = []
    for candidate in (raw, folded):
        if candidate and candidate not in out:
            out.append(candidate)
    # Strip final vowel for stems long enough to stay selective.
    if len(folded) >= 6 and folded[-1] in "αεηιουωaeiou":
        stem = folded[:-1]
        if len(stem) >= 5 and stem not in out:
            out.append(stem)
    return out


def _fetch_sources_by_title_terms(
    sb,
    terms: list[str],
    *,
    per_term: int = 12,
    max_sources: int = 24,
) -> list[dict]:
    """
    Prefer rag_sources title/url match over rag_chunks content ilike.

    Content ilike on 16k+ embedding rows frequently statement-timeouts; the
    sources table is smaller and title hits are far more precise for topics
    like fever / πυρετός.
    """
    found: dict[str, dict] = {}
    patterns: list[str] = []
    for term in terms:
        for variant in _title_query_variants(term):
            if len(_fold_term(variant)) < 5:
                continue
            if variant not in patterns:
                patterns.append(variant)

    for t in patterns:
        pattern = f"%{t}%"
        for column in ("title", "source_url"):
            if len(found) >= max_sources:
                break
            try:
                rows = (
                    sb.table("rag_sources")
                    .select("id,title,source_key,source_url,language")
                    .ilike(column, pattern)
                    .limit(per_term)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                continue
            for row in rows:
                sid = row.get("id")
                if sid and sid not in found:
                    found[sid] = row
        if len(found) >= max_sources:
            break
    return list(found.values())[:max_sources]


def fetch_keyword_candidates(
    sb,
    terms: list[str],
    *,
    per_term: int = 28,
    max_total: int = 80,
    prefer_source_keys: Optional[list[str]] = None,
    topic_anchors: Optional[list[str]] = None,
) -> list[dict]:
    """
    Candidate pull:
    1) rag_sources title/url match → chunks for those sources (precise, fast)
    2) best-effort rag_chunks content ilike (may timeout on large corpora)
    3) load embeddings only for the best / preferred rows

    When topic_anchors are set (e.g. πυρετ), rows matching an anchor are
    prioritized so child names / filler terms cannot crowd them out.
    """
    if not terms:
        return []

    hit_weights: dict[str, float] = {}
    hit_counts: dict[str, int] = {}
    light_rows: dict[str, dict] = {}
    prefer = set(prefer_source_keys or [])
    anchors = expand_anchors_for_match(topic_anchors or [])

    def _remember(row: dict, weight: float) -> None:
        rid = row.get("id")
        if not rid:
            return
        hit_counts[rid] = hit_counts.get(rid, 0) + 1
        hit_weights[rid] = hit_weights.get(rid, 0.0) + weight
        light_rows[rid] = row

    # --- Phase A: title/url on rag_sources (high precision) ---
    title_terms = sorted(terms, key=lambda t: (-_term_match_weight(t), t))
    matched_sources = _fetch_sources_by_title_terms(sb, title_terms)
    source_ids = [str(s["id"]) for s in matched_sources if s.get("id")]
    if source_ids:
        try:
            src_chunks = (
                sb.table("rag_chunks")
                .select("id,source_id,content,metadata")
                .in_("source_id", source_ids[:24])
                .limit(min(60, max_total))
                .execute()
                .data
                or []
            )
        except Exception:
            src_chunks = []
        for row in src_chunks:
            _remember(row, 3.0)

    # --- Phase B: content ilike only if title search was thin ---
    # Full-corpus content ilike often statement-timeouts; skip when we already
    # have precise title-matched sources for the topic.
    title_anchor_hits = 0
    if anchors and light_rows:
        for row in light_rows.values():
            meta = row.get("metadata") or {}
            if not isinstance(meta, dict):
                meta = {}
            blob = _fold_term(
                f"{meta.get('title') or ''} {meta.get('source_url') or ''}"
            )
            if any(a in blob for a in anchors):
                title_anchor_hits += 1
    need_content = title_anchor_hits < 2
    if need_content:
        def _term_priority(term: str) -> tuple:
            tf = _fold_term(term)
            anchorish = 1 if any(a in tf or tf in a for a in anchors) else 0
            return (-anchorish, -len(tf), term)

        ordered_terms = sorted(terms, key=_term_priority)
        content_terms = [
            t
            for t in ordered_terms
            if not anchors or any(a in _fold_term(t) for a in anchors) or not light_rows
        ] or ordered_terms
        for term in content_terms[:2]:
            pattern = f"%{term}%"
            limit_n = min(per_term, 20)
            try:
                rows = (
                    sb.table("rag_chunks")
                    .select("id,source_id,content,metadata")
                    .ilike("content", pattern)
                    .limit(limit_n)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                continue
            weight = _term_match_weight(term)
            if any(a in _fold_term(term) for a in anchors):
                weight += 1.5
            for row in rows:
                _remember(row, weight)

    if not light_rows:
        return []

    def _anchor_tier(rid: str) -> int:
        """2 = title/url topic hit, 1 = body-only, 0 = none."""
        if not anchors:
            return 0
        meta = light_rows[rid].get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        title_f = _fold_term(str(meta.get("title") or ""))
        url_f = _fold_term(str(meta.get("source_url") or meta.get("url") or ""))
        if any(a in title_f or a in url_f for a in anchors):
            return 2
        content_f = _fold_term(light_rows[rid].get("content") or "")
        return 1 if any(a in content_f for a in anchors) else 0

    def _sort_key(rid: str) -> tuple:
        meta = light_rows[rid].get("metadata") or {}
        sk = meta.get("source_key") or ""
        preferred = 1 if sk in prefer else 0
        return (
            -_anchor_tier(rid),
            -preferred,
            -hit_weights.get(rid, 0.0),
            -hit_counts.get(rid, 0),
        )

    ordered_ids = sorted(light_rows.keys(), key=_sort_key)[:max_total]
    # Cap embedding downloads — prefer halfvec (smaller); fall back to full.
    embed_ids = ordered_ids[: min(48, len(ordered_ids))]
    if not embed_ids:
        return []

    try:
        heavy = (
            sb.table("rag_chunks")
            .select("id,source_id,content,metadata,embedding_half")
            .in_("id", embed_ids)
            .execute()
            .data
            or []
        )
    except Exception:
        # Legacy DBs that still expose full embedding only.
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
    prefer_languages: Optional[list[str]] = None,
    terms: Optional[list[str]] = None,
    topic_anchors: Optional[list[str]] = None,
) -> list[dict]:
    prefer = set(prefer_source_keys or [])
    prefer_langs = list(prefer_languages or [])
    terms_l = [t.lower() for t in (terms or [])]
    anchors = expand_anchors_for_match(topic_anchors or [])
    scored: list[tuple[float, dict]] = []
    for row in candidates:
        emb = parse_embedding(row.get("embedding_half")) or parse_embedding(
            row.get("embedding")
        )
        if not emb:
            continue
        sim = cosine_similarity(query_embedding, emb)
        meta = row.get("metadata") or {}
        if not isinstance(meta, dict):
            meta = {}
        sk = meta.get("source_key") or ""
        content_l = (row.get("content") or "").lower()
        content_f = _fold_term(content_l)
        title_f = _fold_term(str(meta.get("title") or meta.get("source_title") or ""))
        url_f = _fold_term(str(meta.get("source_url") or meta.get("url") or ""))
        term_weight = sum(
            _term_match_weight(t) for t in terms_l if t in content_l or _fold_term(t) in content_f
        )
        anchor_hit = bool(anchors) and any(a in content_f for a in anchors)
        anchor_in_title = bool(anchors) and any(a in title_f or a in url_f for a in anchors)
        # When the user asked about a clear medical topic, drop chunks that
        # never mention it — cosine alone clusters parenting articles together.
        if anchors and not anchor_hit and sk not in prefer:
            continue
        boost = 0.0
        if sk in prefer:
            boost += 0.04
        boost += language_boost(chunk_language(meta, source_key=str(sk)), prefer_langs)
        boost += min(0.06, 0.02 * term_weight)
        if anchor_hit:
            boost += 0.04
        # Title/URL topic match dominates casual one-line mentions inside unrelated posts.
        if anchor_in_title:
            boost += 0.14
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
    try_rpc: bool = True,
    prefer_lang: Optional[str] = None,
) -> tuple[list[dict], dict]:
    """
    Prefer match_chunks (HNSW halfvec) then keyword + local cosine fallback.

    Soft-prioritizes chunks in the user's language (then English), without
    excluding other languages.

    Disable RPC with RAG_USE_MATCH_RPC=0 if needed.
    """
    prefer_langs = prefer_languages_for_user(prefer_lang)
    meta: dict[str, Any] = {
        "path": None,
        "rpc_ms": 0.0,
        "fallback_ms": 0.0,
        "candidates": 0,
        "error": None,
        "prefer_languages": prefer_langs,
    }

    env_rpc = (os.getenv("RAG_USE_MATCH_RPC") or "").strip().lower()
    if env_rpc in {"0", "false", "no", "off"}:
        use_rpc = False
    elif env_rpc in {"1", "true", "yes", "on"}:
        use_rpc = True
    else:
        use_rpc = bool(try_rpc)
    if use_rpc and supabase_url and service_key:
        t0 = time.perf_counter()
        try:
            rows = match_chunks_rpc(
                supabase_url=supabase_url,
                service_key=service_key,
                query_embedding=query_embedding,
                match_count=max(top_k * 2, top_k),
                match_threshold=threshold,
                timeout=rpc_timeout,
            )
            meta["rpc_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            filtered = [r for r in rows if (r.get("content") or "").strip()]
            if filtered:
                meta["path"] = "match_chunks"
                return rerank_by_language(filtered, prefer_langs)[:top_k], meta
        except Exception as e:
            meta["rpc_ms"] = round((time.perf_counter() - t0) * 1000, 1)
            meta["error"] = str(e)[:200]

    t1 = time.perf_counter()
    terms = search_terms_for_query(query)
    anchors = topic_anchors_in_text(query)
    prefer = hinted_source_keys(query)
    per_term = max(24, min(40, 100 // max(len(terms), 1)))
    candidates = fetch_keyword_candidates(
        sb,
        terms,
        per_term=per_term,
        max_total=80,
        prefer_source_keys=prefer,
        topic_anchors=anchors,
    )
    meta["candidates"] = len(candidates)
    meta["terms"] = terms[:12]
    meta["topic_anchors"] = anchors[:8]
    ranked = rank_candidates(
        candidates,
        query_embedding,
        top_k=top_k,
        threshold=threshold,
        prefer_source_keys=prefer,
        prefer_languages=prefer_langs,
        terms=terms,
        topic_anchors=anchors,
    )
    if not ranked and candidates:
        # Soften similarity threshold but keep topic-anchor filter when present
        # so we never fall back to unrelated parenting noise.
        ranked = rank_candidates(
            candidates,
            query_embedding,
            top_k=top_k,
            threshold=max(0.12, threshold - 0.1),
            prefer_source_keys=prefer,
            prefer_languages=prefer_langs,
            terms=terms,
            topic_anchors=anchors or None,
        )
    meta["fallback_ms"] = round((time.perf_counter() - t1) * 1000, 1)
    meta["path"] = "keyword_cosine"
    return ranked, meta
