"""Shared RAG ingest helpers for admin upload and CLI scripts."""
from __future__ import annotations

import os
import re
import threading
import time
from typing import Optional

import requests

CHUNK_SIZE = 400
CHUNK_OVERLAP = 60
MIN_CHUNK_CHARS = 30
EMBED_MODEL = "models/gemini-embedding-001"
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB
ALLOWED_EXTENSIONS = {".txt", ".md", ".markdown", ".pdf"}


def _gemini_api_key() -> str:
    for name in (
        "Gemini_Heymaa_API_Key",
        "GEMINI_HEYMAA_API_KEY",
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
    ):
        val = (os.getenv(name) or "").strip().strip('"').strip("'")
        if val:
            return val
    return ""


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Word-window chunking that keeps markdown tables / fact blocks intact when possible."""
    blocks = re.split(r"\n\s*\n", (text or "").strip())
    chunks: list[str] = []

    def flush_words(words: list[str]) -> None:
        start = 0
        while start < len(words):
            end = start + chunk_size
            chunk = " ".join(words[start:end]).strip()
            if len(chunk) > MIN_CHUNK_CHARS:
                chunks.append(chunk)
            if end >= len(words):
                break
            start = max(0, end - overlap)

    pending: list[str] = []
    for block in blocks:
        b = (block or "").strip()
        if not b:
            continue
        is_tableish = (
            b.startswith("|")
            or b.startswith("[Πίνακας")
            or b.startswith("[ΠΙΝΑΚΑΣ")
            or "\n| ---" in b
            or "\n|---" in b
        )
        if is_tableish:
            if pending:
                flush_words(pending)
                pending = []
            # Keep whole table if reasonably sized; otherwise split by rows.
            words = b.split()
            if len(words) <= chunk_size * 2:
                if len(b) > MIN_CHUNK_CHARS:
                    chunks.append(b)
            else:
                rows = b.splitlines()
                buf: list[str] = []
                header_prefix: list[str] = []
                if rows and rows[0].startswith("|"):
                    header_prefix = rows[:2] if len(rows) > 1 and "---" in rows[1] else rows[:1]
                for row in rows[len(header_prefix) :]:
                    trial_rows = header_prefix + buf + [row]
                    trial = "\n".join(trial_rows).strip()
                    if buf and len(trial.split()) > chunk_size:
                        chunks.append("\n".join(header_prefix + buf).strip())
                        buf = [row]
                    else:
                        buf.append(row)
                if buf:
                    piece = "\n".join(header_prefix + buf).strip()
                    if len(piece) > MIN_CHUNK_CHARS:
                        chunks.append(piece)
            continue
        pending.extend(b.split())
        if len(pending) >= chunk_size:
            flush_words(pending)
            pending = pending[-overlap:] if overlap else []

    if pending:
        flush_words(pending)
    return chunks


def read_text_bytes(data: bytes, filename: str = "") -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return extract_text_from_pdf_bytes(data)
    for enc in ("utf-8", "utf-8-sig", "cp1253", "latin-1"):
        try:
            return data.decode(enc).strip()
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise ValueError("Could not decode text file.")


def _pdf_clean_cell(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\n", " ")).strip()


def _pdf_coalesce_table(data: list[list], *, min_fill: float = 0.08) -> list[list[str]]:
    """Collapse over-split PDF table columns into a usable grid."""
    if not data:
        return []
    nrows = len(data)
    ncols = max((len(r) for r in data), default=0)
    if ncols == 0:
        return []
    grid = [list(r) + [""] * (ncols - len(r)) for r in data]
    fill = []
    for c in range(ncols):
        nonempty = sum(1 for r in range(nrows) if _pdf_clean_cell(grid[r][c]))
        fill.append(nonempty / max(nrows, 1))
    kept = [i for i, f in enumerate(fill) if f >= min_fill]
    if not kept:
        kept = list(range(ncols))
    if 0 not in kept:
        kept = [0] + kept
    kept = sorted(set(kept))

    out: list[list[str]] = []
    for r in range(nrows):
        row_out = [""] * len(kept)
        for c in range(ncols):
            val = _pdf_clean_cell(grid[r][c])
            if not val:
                continue
            nearest = min(kept, key=lambda k: abs(k - c))
            j = kept.index(nearest)
            row_out[j] = f"{row_out[j]} {val}".strip() if row_out[j] else val
        if any(row_out):
            out.append(row_out)
    # Drop columns that stayed empty after coalesce.
    if not out:
        return []
    keep_cols = [c for c in range(len(out[0])) if any(_pdf_clean_cell(r[c]) for r in out)]
    return [[r[c] for c in keep_cols] for r in out]


def _pdf_table_to_markdown(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    # Cap extremely wide tables by pairwise merge.
    while len(rows[0]) > 18:
        merged: list[list[str]] = []
        for r in rows:
            nr: list[str] = []
            i = 0
            while i < len(r):
                if i + 1 < len(r):
                    nr.append(f"{r[i]} {r[i + 1]}".strip())
                    i += 2
                else:
                    nr.append(r[i])
                    i += 1
            merged.append(nr)
        rows = merged
    header = [c or " " for c in rows[0]]
    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ]
    for r in rows[1:]:
        lines.append("| " + " | ".join(c or "" for c in r) + " |")
    return "\n".join(lines)


def _pdf_table_to_facts(rows: list[list[str]]) -> str:
    """Row-wise facts — better for RAG than a huge markdown grid alone."""
    if len(rows) < 2:
        return ""
    headers = [_pdf_clean_cell(h) for h in rows[0]]
    # If first header looks broken, synthesize age-like labels from remaining headers.
    facts: list[str] = []
    for r in rows[1:]:
        vaccine = _pdf_clean_cell(r[0] if r else "")
        if not vaccine or len(vaccine) < 2:
            continue
        # Skip continuation fragments that are only dose markers
        pairs = []
        for i in range(1, min(len(r), len(headers))):
            cell = _pdf_clean_cell(r[i])
            if not cell:
                continue
            age = headers[i] or f"στήλη-{i}"
            # Avoid pure unit leftovers
            if age.lower() in {"μηνός", "μηνών", "μηνώ", "ηνών", "ετών", "ν", "μ"}:
                continue
            pairs.append(f"{age}: {cell}")
        if pairs:
            facts.append(f"- {vaccine} → " + "; ".join(pairs))
        else:
            # still keep vaccine row text if body cells exist without useful headers
            body = [_pdf_clean_cell(c) for c in r[1:] if _pdf_clean_cell(c)]
            if body:
                facts.append(f"- {vaccine} → " + " | ".join(body))
    if not facts:
        return ""
    return "[Πίνακας εμβολιασμών — ανά εμβόλιο]\n" + "\n".join(facts)


def _pdf_extract_page_tables(page) -> str:
    try:
        finder = page.find_tables()
        tables = list(getattr(finder, "tables", []) or [])
    except Exception:
        return ""
    parts: list[str] = []
    for idx, tab in enumerate(tables, 1):
        try:
            raw = tab.extract() or []
        except Exception:
            continue
        rows = _pdf_coalesce_table(raw)
        if len(rows) < 2 or len(rows[0]) < 2:
            continue
        md = _pdf_table_to_markdown(rows)
        facts = _pdf_table_to_facts(rows)
        block = f"[Πίνακας {idx}]\n{md}"
        if facts:
            block += "\n\n" + facts
        parts.append(block)
    return "\n\n".join(parts).strip()


def extract_text_from_pdf_bytes(data: bytes) -> str:
    """Extract PDF text with table preservation (markdown + per-vaccine facts)."""
    try:
        import fitz  # PyMuPDF
    except ImportError as e:
        raise ValueError(
            "PDF support requires PyMuPDF. Convert to .txt/.md or install pymupdf."
        ) from e
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        parts: list[str] = []
        for page_i, page in enumerate(doc, 1):
            plain = (page.get_text("text") or "").strip()
            tables = _pdf_extract_page_tables(page)
            page_bits = [f"[Σελίδα {page_i}]"]
            if plain:
                page_bits.append(plain)
            if tables:
                page_bits.append(tables)
            parts.append("\n\n".join(page_bits))
        return "\n\n".join(parts).strip()
    finally:
        doc.close()


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name) or default)
    except ValueError:
        return default


# Gemini free tier allows ~100 embed requests/min. Stay under it by default
# (0.7s ~= 85 req/min). Set RAG_EMBED_MIN_INTERVAL=0 on a paid tier.
EMBED_MIN_INTERVAL = _env_float("RAG_EMBED_MIN_INTERVAL", 0.7)
EMBED_MAX_RETRIES = int(_env_float("RAG_EMBED_MAX_RETRIES", 6))
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_embed_lock = threading.Lock()
_last_embed_call = 0.0


def _throttle_embed() -> None:
    """Serialise + space out embedding calls across all ingest threads."""
    global _last_embed_call
    if EMBED_MIN_INTERVAL <= 0:
        return
    with _embed_lock:
        wait = EMBED_MIN_INTERVAL - (time.monotonic() - _last_embed_call)
        if wait > 0:
            time.sleep(wait)
        _last_embed_call = time.monotonic()


def _retry_delay_seconds(res: "requests.Response", attempt: int) -> float:
    """Honour Retry-After / Google's RetryInfo.retryDelay, else exponential backoff."""
    header = res.headers.get("Retry-After")
    if header:
        try:
            return min(float(header), 90.0)
        except ValueError:
            pass
    try:
        for detail in (res.json().get("error") or {}).get("details") or []:
            delay = detail.get("retryDelay")
            if isinstance(delay, str) and delay.endswith("s"):
                return min(float(delay[:-1]) + 1.0, 90.0)
    except Exception:
        pass
    return min(5.0 * (2**attempt), 60.0)


def get_document_embedding(text: str) -> list[float]:
    key = _gemini_api_key()
    if not key:
        raise ValueError("GEMINI_API_KEY is not configured.")
    url = f"https://generativelanguage.googleapis.com/v1beta/{EMBED_MODEL}:embedContent?key={key}"
    payload = {
        "model": EMBED_MODEL,
        "content": {"parts": [{"text": text}]},
        "taskType": "RETRIEVAL_DOCUMENT",
    }
    res = None
    for attempt in range(EMBED_MAX_RETRIES + 1):
        _throttle_embed()
        try:
            res = requests.post(url, json=payload, timeout=30)
        except (requests.Timeout, requests.ConnectionError):
            if attempt >= EMBED_MAX_RETRIES:
                raise
            time.sleep(min(5.0 * (2**attempt), 60.0))
            continue
        if res.status_code not in _RETRYABLE_STATUS or attempt >= EMBED_MAX_RETRIES:
            break
        time.sleep(_retry_delay_seconds(res, attempt))
    res.raise_for_status()
    values = res.json().get("embedding", {}).get("values")
    if not values:
        raise ValueError("Embedding response missing values.")
    return values


def source_type_for_filename(filename: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return "pdf"
    return "text"


def validate_upload_filename(filename: str) -> str:
    base = os.path.basename(filename or "").strip()
    if not base:
        raise ValueError("Filename is required.")
    ext = os.path.splitext(base)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Allowed file types: .txt, .md, .pdf")
    return base


def ingest_text_into_source(
    sb,
    *,
    source_id: str,
    title: str,
    text: str,
    replace_existing: bool = True,
    sleep_seconds: float = 0.15,
    metadata_extra: Optional[dict] = None,
) -> dict:
    """Chunk + embed + store. Updates rag_sources status/chunk_count."""
    if not _gemini_api_key():
        raise ValueError(
            "GEMINI_API_KEY is not configured on the server. "
            "Add it to backend/.env (and Vercel env) to create embeddings/chunks."
        )

    if replace_existing:
        sb.table("rag_chunks").delete().eq("source_id", source_id).execute()

    sb.table("rag_sources").update({"status": "processing", "chunk_count": 0}).eq(
        "id", source_id
    ).execute()

    words = len(text.split())
    if words == 0 or not text.strip():
        sb.table("rag_sources").update({"status": "error", "chunk_count": 0}).eq(
            "id", source_id
        ).execute()
        raise ValueError("No text found in file.")

    chunks = chunk_text(text)
    if not chunks:
        sb.table("rag_sources").update({"status": "error", "chunk_count": 0}).eq(
            "id", source_id
        ).execute()
        raise ValueError("Text too short to create chunks.")

    success = 0
    errors: list[str] = []
    extra = dict(metadata_extra or {})
    for i, chunk in enumerate(chunks):
        try:
            embedding = get_document_embedding(chunk)
            meta = {"chunk_index": i + 1, "title": title, **extra}
            sb.table("rag_chunks").insert(
                {
                    "source_id": source_id,
                    "content": chunk,
                    "embedding": embedding,
                    # Dedicated halfvec column powers HNSW match_chunks (see migration).
                    "embedding_half": embedding,
                    "metadata": meta,
                }
            ).execute()
            success += 1
            if sleep_seconds > 0:
                time.sleep(sleep_seconds)
        except Exception as e:
            # Fallback if embedding_half column is not migrated yet
            if "embedding_half" in str(e):
                try:
                    sb.table("rag_chunks").insert(
                        {
                            "source_id": source_id,
                            "content": chunk,
                            "embedding": embedding,
                            "metadata": meta,
                        }
                    ).execute()
                    success += 1
                    if sleep_seconds > 0:
                        time.sleep(sleep_seconds)
                    continue
                except Exception as e2:
                    e = e2
            msg = str(e)
            # Never leak API keys that may appear in exception URLs
            msg = re.sub(r"(key=)[^&\s]+", r"\1***", msg, flags=re.I)
            errors.append(f"chunk {i + 1}: {msg}")

    status = "ready" if success > 0 else "error"
    sb.table("rag_sources").update({"status": status, "chunk_count": success}).eq(
        "id", source_id
    ).execute()

    if success == 0:
        detail = errors[0] if errors else "No chunks were stored."
        raise ValueError(f"Failed to create chunks: {detail}")

    return {
        "chunk_count": success,
        "chunk_total": len(chunks),
        "status": status,
        "errors": errors[:5],
    }


def create_source_and_ingest(
    sb,
    *,
    title: str,
    filename: str,
    file_bytes: bytes,
    source_key: Optional[str] = None,
) -> dict:
    origin = validate_upload_filename(filename)
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise ValueError("File must be 8 MB or smaller.")
    if not file_bytes:
        raise ValueError("Empty file.")

    text = read_text_bytes(file_bytes, origin)
    source_type = source_type_for_filename(origin)
    try:
        from .rag_seed_jobs import slug_from_filename, upsert_knowledge_source
    except ImportError:
        from rag_seed_jobs import slug_from_filename, upsert_knowledge_source

    key = (source_key or "").strip().lower() or slug_from_filename(origin)
    inserted = (
        sb.table("rag_sources")
        .insert(
            {
                "title": title,
                "source_type": source_type,
                "origin": origin,
                "source_key": key,
                "status": "processing",
                "chunk_count": 0,
            }
        )
        .execute()
    )
    if not inserted.data:
        raise ValueError("Failed to create rag source.")
    source = inserted.data[0]
    source_id = source["id"]
    try:
        result = ingest_text_into_source(
            sb, source_id=source_id, title=title, text=text, replace_existing=False
        )
    except Exception:
        sb.table("rag_sources").update({"status": "error"}).eq("id", source_id).execute()
        raise

    upsert_knowledge_source(
        sb,
        source_key=key,
        name=title or key,
        source_type="file",
        language="el",
        base_url=None,
        metadata_extra={"filename": origin, "seed": True},
        merge_existing=True,
    )

    refreshed = (
        sb.table("rag_sources").select("*").eq("id", source_id).limit(1).execute()
    )
    row = (refreshed.data or [source])[0]
    return {"source": row, **result}


def _find_source_by_url(sb, source_url: str):
    try:
        res = (
            sb.table("rag_sources")
            .select("*")
            .eq("source_url", source_url)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
    except Exception:
        pass
    res = sb.table("rag_sources").select("*").eq("origin", source_url).limit(1).execute()
    return (res.data or [None])[0]


def url_already_ingested(sb, url: str) -> bool:
    """True when this URL already has a healthy (ready, >0 chunks) rag_source."""
    try:
        from .url_acquire import normalize_url
    except ImportError:
        from url_acquire import normalize_url
    try:
        row = _find_source_by_url(sb, normalize_url(url))
    except Exception:
        return False
    return bool(row) and row.get("status") == "ready" and int(row.get("chunk_count") or 0) > 0


def create_or_update_url_source_and_ingest(
    sb,
    *,
    url: str,
    title: Optional[str] = None,
    source_key: Optional[str] = None,
    language: Optional[str] = None,
    replace_existing: bool = True,
    sleep_seconds: float = 0.12,
) -> dict:
    """Fetch a URL, upsert rag_sources row, chunk + embed into rag_chunks."""
    try:
        from .url_acquire import acquire_url
    except ImportError:
        from url_acquire import acquire_url

    acquired = acquire_url(url)
    source_url = acquired["source_reference"]
    page_title = (title or acquired.get("title") or source_url).strip()
    text = acquired["content"]
    lang = language or acquired.get("language") or "el"

    existing = _find_source_by_url(sb, source_url)
    payload = {
        "title": page_title,
        "source_type": "url",
        "origin": source_url,
        "status": "processing",
        "chunk_count": 0,
    }
    # Optional columns from migration rag_url_sources.sql
    for key, value in (
        ("source_url", source_url),
        ("source_key", source_key),
        ("language", lang),
        ("enabled", True),
    ):
        if value is not None:
            payload[key] = value

    if existing:
        source_id = existing["id"]
        try:
            sb.table("rag_sources").update(payload).eq("id", source_id).execute()
        except Exception:
            # Columns may not exist yet — fall back to core fields only
            core = {
                "title": page_title,
                "source_type": "url",
                "origin": source_url,
                "status": "processing",
                "chunk_count": 0,
            }
            sb.table("rag_sources").update(core).eq("id", source_id).execute()
    else:
        try:
            inserted = sb.table("rag_sources").insert(payload).execute()
        except Exception:
            inserted = (
                sb.table("rag_sources")
                .insert(
                    {
                        "title": page_title,
                        "source_type": "url",
                        "origin": source_url,
                        "status": "processing",
                        "chunk_count": 0,
                    }
                )
                .execute()
            )
        if not inserted.data:
            raise ValueError("Failed to create rag source for URL.")
        source_id = inserted.data[0]["id"]

    try:
        result = ingest_text_into_source(
            sb,
            source_id=source_id,
            title=page_title,
            text=text,
            replace_existing=replace_existing,
            sleep_seconds=sleep_seconds,
            metadata_extra={
                "source_url": source_url,
                "source_key": source_key,
                "language": lang,
                "source_type": "url",
            },
        )
    except Exception:
        sb.table("rag_sources").update({"status": "error"}).eq("id", source_id).execute()
        raise

    refreshed = sb.table("rag_sources").select("*").eq("id", source_id).limit(1).execute()
    row = (refreshed.data or [{"id": source_id}])[0]
    return {
        "source": row,
        "url": source_url,
        "word_count": acquired.get("metadata", {}).get("word_count"),
        **result,
    }
