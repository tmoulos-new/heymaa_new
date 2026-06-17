import sys, os, time, requests
from dotenv import load_dotenv
from supabase import create_client
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
EMBED_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEMINI_KEY}"
CHUNK_SIZE = 400
CHUNK_OVERLAP = 60
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

def read_text(path):
    for enc in ["utf-8", "utf-8-sig", "cp1253", "latin-1"]:
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read().strip()
        except (UnicodeDecodeError, UnicodeError):
            continue
    return ""

def chunk_text(text):
    words = text.split()
    chunks, start = [], 0
    while start < len(words):
        end = start + CHUNK_SIZE
        chunk = " ".join(words[start:end])
        if len(chunk.strip()) > 30:
            chunks.append(chunk.strip())
        start = end - CHUNK_OVERLAP
    return chunks

def get_embedding(text, retries=3):
    for attempt in range(retries):
        r = requests.post(EMBED_URL, json={"model":"models/gemini-embedding-001","content":{"parts":[{"text":text}]}})
        if r.status_code == 200:
            return r.json()["embedding"]["values"]
        elif r.status_code == 429:
            wait = 10 * (attempt + 1)
            print(f"\n       Rate limited, waiting {wait}s...", end="")
            time.sleep(wait)
        else:
            raise Exception(f"API error {r.status_code}: {r.text[:200]}")
    raise Exception("Max retries exceeded")

def ingest(file_path, title):
    print(f"\n  HeyMaa RAG Ingest v2")
    print(f"  File: {file_path} | Title: {title}\n")
    source = sb.table("rag_sources").insert({"title":title,"source_type":"text","origin":os.path.basename(file_path),"status":"processing"}).execute()
    source_id = source.data[0]["id"]
    text = read_text(file_path)
    words = len(text.split())
    print(f"  {words} words found")
    if words == 0:
        print("  ERROR: Empty!")
        return
    chunks = chunk_text(text)
    print(f"  {len(chunks)} chunks. Embedding...")
    ok = 0
    for i, chunk in enumerate(chunks):
        try:
            emb = get_embedding(chunk)
            sb.table("rag_chunks").insert({"source_id":source_id,"content":chunk,"embedding":emb,"metadata":{"chunk_index":i+1,"title":title}}).execute()
            ok += 1
            print(f"  [{ok}/{len(chunks)}]", end="\r")
            time.sleep(1.5)
        except Exception as e:
            print(f"\n  [{i+1}] ERROR: {e}")
    sb.table("rag_sources").update({"status":"ready","chunk_count":ok}).eq("id",source_id).execute()
    print(f"\n  DONE! {ok}/{len(chunks)} chunks stored.\n")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print('Usage: python ingest_v2.py <file> <title>')
        sys.exit(1)
    if not os.path.exists(sys.argv[1]):
        print(f"ERROR: File not found: {sys.argv[1]}")
        sys.exit(1)
    ingest(sys.argv[1], sys.argv[2])
