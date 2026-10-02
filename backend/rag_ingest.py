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
    words = text.split()
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end]).strip()
        if len(chunk) > MIN_CHUNK_CHARS:
            chunks.append(chunk)
        start = end - overlap
        if start < 0:
            start = 0
        if end >= len(words):
            break
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


def extract_text_from_pdf_bytes(data: bytes) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError as e:
        raise ValueError(
            "PDF support requires PyMuPDF. Convert to .txt/.md or install pymupdf."
        ) from e
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        parts: list[str] = []
        for page in doc:
            parts.append(page.get_text() or "")
        return "\n".join(parts).strip()
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
