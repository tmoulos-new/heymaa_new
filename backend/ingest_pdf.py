"""
HeyMaa RAG Ingest Script
Extracts text from PDFs, chunks it, creates embeddings, stores in Supabase.

Usage:
  python ingest_pdf.py "path/to/file.pdf" "My Document Title"
"""
import sys
import os
import time
import json
from dotenv import load_dotenv

load_dotenv()

import fitz  # PyMuPDF
import google.generativeai as genai
from supabase import create_client

# ── Config ──
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

CHUNK_SIZE = 500      # words per chunk
CHUNK_OVERLAP = 50    # overlap words between chunks
EMBED_MODEL = "models/text-embedding-004"

# ── Init clients ──
sb = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_KEY)


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from a PDF file."""
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
    doc.close()
    return text.strip()


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks by word count."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if len(chunk.strip()) > 20:  # skip tiny chunks
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks


def get_embedding(text: str) -> list[float]:
    """Get embedding vector from Gemini."""
    result = genai.embed_content(
        model=EMBED_MODEL,
        content=text,
        task_type="retrieval_document"
    )
    return result["embedding"]


def ingest_pdf(pdf_path: str, title: str):
    """Full pipeline: PDF -> chunks -> embeddings -> Supabase."""
    print(f"\n{'='*60}")
    print(f"  HeyMaa RAG Ingest")
    print(f"{'='*60}")
    print(f"  File:  {pdf_path}")
    print(f"  Title: {title}")
    print()

    # 1. Register source
    print("[1/4] Registering source...")
    source = sb.table("rag_sources").insert({
        "title": title,
        "source_type": "pdf",
        "origin": os.path.basename(pdf_path),
        "status": "processing"
    }).execute()
    source_id = source.data[0]["id"]
    print(f"       Source ID: {source_id}")

    # 2. Extract text
    print("[2/4] Extracting text from PDF...")
    text = extract_text_from_pdf(pdf_path)
    word_count = len(text.split())
    print(f"       Extracted {word_count} words")

    # 3. Chunk
    print("[3/4] Chunking text...")
    chunks = chunk_text(text)
    print(f"       Created {len(chunks)} chunks")

    # 4. Embed & store
    print(f"[4/4] Embedding & storing chunks...")
    success = 0
    for i, chunk in enumerate(chunks):
        try:
            embedding = get_embedding(chunk)
            sb.table("rag_chunks").insert({
                "source_id": source_id,
                "content": chunk,
                "embedding": embedding,
                "metadata": {"page_approx": i + 1, "title": title}
            }).execute()
            success += 1
            print(f"       [{success}/{len(chunks)}] OK", end="\r")
            time.sleep(0.3)  # rate limit courtesy
        except Exception as e:
            print(f"\n       [{i+1}] ERROR: {e}")

    # Update source status
    sb.table("rag_sources").update({
        "status": "ready",
        "chunk_count": success
    }).eq("id", source_id).execute()

    print(f"\n\n  DONE! {success}/{len(chunks)} chunks stored.")
    print(f"  Source '{title}' is now READY.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python ingest_pdf.py <pdf_path> <title>")
        print('Example: python ingest_pdf.py "C:\\docs\\pregnancy.pdf" "Pregnancy Guide 2026"')
        sys.exit(1)

    pdf_path = sys.argv[1]
    title = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(f"ERROR: File not found: {pdf_path}")
        sys.exit(1)

    ingest_pdf(pdf_path, title)
