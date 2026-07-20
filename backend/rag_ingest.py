"""Shared RAG ingest helpers for admin upload and CLI scripts."""
from __future__ import annotations

import os
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
    return (os.getenv("GEMINI_API_KEY") or "").strip()


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


def get_document_embedding(text: str) -> list[float]:
    key = _gemini_api_key()
    if not key:
        raise ValueError("GEMINI_API_KEY is not configured.")
    url = f"https://generativelanguage.googleapis.com/v1beta/{EMBED_MODEL}:embedContent?key={key}"
    res = requests.post(
        url,
        json={
            "model": EMBED_MODEL,
            "content": {"parts": [{"text": text}]},
            "taskType": "RETRIEVAL_DOCUMENT",
        },
        timeout=30,
    )
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
    for i, chunk in enumerate(chunks):
        try:
            embedding = get_document_embedding(chunk)
            sb.table("rag_chunks").insert(
                {
                    "source_id": source_id,
                    "content": chunk,
                    "embedding": embedding,
                    "metadata": {"chunk_index": i + 1, "title": title},
                }
            ).execute()
            success += 1
            if sleep_seconds > 0:
                time.sleep(sleep_seconds)
        except Exception as e:
            errors.append(f"chunk {i + 1}: {e}")

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
) -> dict:
    origin = validate_upload_filename(filename)
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise ValueError("File must be 8 MB or smaller.")
    if not file_bytes:
        raise ValueError("Empty file.")

    text = read_text_bytes(file_bytes, origin)
    source_type = source_type_for_filename(origin)
    inserted = (
        sb.table("rag_sources")
        .insert(
            {
                "title": title,
                "source_type": source_type,
                "origin": origin,
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

    refreshed = (
        sb.table("rag_sources").select("*").eq("id", source_id).limit(1).execute()
    )
    row = (refreshed.data or [source])[0]
    return {"source": row, **result}
