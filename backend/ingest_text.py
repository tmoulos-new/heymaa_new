"""
HeyMaa RAG Ingest Script
Ingests text files into the knowledge base.

Usage:
  python ingest_text.py "path/to/file.txt" "My Document Title"
"""
import sys
import os
import time
from dotenv import load_dotenv

load_dotenv()

import google.generativeai as genai
from supabase import create_client

# -- Config --
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

CHUNK_SIZE = 400      # words per chunk
CHUNK_OVERLAP = 60    # overlap words between chunks
EMBED_MODEL = "models/gemini-embedding-001"

# -- Init clients --
sb = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_KEY)


def read_text_file(path: str) -> str:
    """Read text from a file, trying common encodings."""
    for enc in ["utf-8", "utf-8-sig", "cp1253", "latin-1"]:
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read().strip()
        except (UnicodeDecodeError, UnicodeError):
            continue
    raise ValueError(f"Could not decode file: {path}")


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks by word count."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if len(chunk.strip()) > 30:
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


def ingest(file_path: str, title: str):
    """Full pipeline: text file -> chunks -> embeddings -> Supabase."""
    print(f"\n{'='*60}")
    print(f"  HeyMaa RAG Ingest")
    print(f"{'='*60}")
    print(f"  File:  {file_path}")
    print(f"  Title: {title}")
    print()

    # 1. Register source
    print("[1/4] Registering source...")
    source = sb.table("rag_sources").insert({
        "title": title,
        "source_type": "text",
        "origin": os.path.basename(file_path),
        "status": "processing"
    }).execute()
    source_id = source.data[0]["id"]
    print(f"       Source ID: {source_id}")

    # 2. Read text
    print("[2/4] Reading text file...")
    text = read_text_file(file_path)
    word_count = len(text.split())
    print(f"       Read {word_count} words")

    if word_count == 0:
        print("       ERROR: No text found!")
        sb.table("rag_sources").update({"status": "error"}).eq("id", source_id).execute()
        return

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
                "metadata": {"chunk_index": i + 1, "title": title}
            }).execute()
            success += 1
            print(f"       [{success}/{len(chunks)}] OK", end="\r")
            time.sleep(0.3)  # rate limit
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
        print('Usage: python ingest_text.py <file_path> <title>')
        print('Example: python ingest_text.py "C:\\heymaa\\data\\guide.txt" "Pregnancy Guide"')
        sys.exit(1)

    file_path = sys.argv[1]
    title = sys.argv[2]

    if not os.path.exists(file_path):
        print(f"ERROR: File not found: {file_path}")
        sys.exit(1)

    ingest(file_path, title)
