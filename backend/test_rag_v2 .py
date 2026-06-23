"""
HeyMaa RAG Test v2
Uses Gemini REST API for embeddings.

Usage:
  python test_rag_v2.py "your question here"
"""
import sys
import os
import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")
EMBED_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEMINI_KEY}"

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_query_embedding(text):
    r = requests.post(EMBED_URL, json={
        "model": "models/gemini-embedding-001",
        "content": {"parts": [{"text": text}]}
    })
    if r.status_code == 200:
        return r.json()["embedding"]["values"]
    raise Exception(f"Embedding error: {r.status_code}")


def search_knowledge(query, top_k=5):
    emb = get_query_embedding(query)
    result = sb.rpc("match_chunks", {
        "query_embedding": emb,
        "match_count": top_k,
        "match_threshold": 0.3
    }).execute()
    return result.data


def generate_answer(query, chunks):
    context = "\n\n---\n\n".join([
        f"[Source: {c.get('metadata', {}).get('title', '?')}]\n{c['content']}"
        for c in chunks
    ])

    system = """You are HeyMaa, a warm and supportive AI companion for mothers.
You are like a trusted, non-judgmental friend. You NEVER give medical advice - always
redirect to a doctor or pharmacist for health concerns.
Use the knowledge base excerpts to inform your answer naturally.
If excerpts are not relevant, answer from general knowledge.
Respond in the same language as the question."""

    user = f"Knowledge base:\n{context}\n\n---\nQuestion: {query}"

    r = requests.post("https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
        json={"model": "llama-3.3-70b-versatile",
              "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
              "temperature": 0.7, "max_tokens": 800})

    return r.json()["choices"][0]["message"]["content"] if r.status_code == 200 else f"Error: {r.text}"


def test(query):
    print(f"\n{'='*60}")
    print(f"  HeyMaa RAG Test v2")
    print(f"{'='*60}")
    print(f"  Q: {query}\n")

    print("[1/2] Searching knowledge base...")
    chunks = search_knowledge(query)

    if not chunks:
        print("       No relevant chunks found.")
    else:
        print(f"       Found {len(chunks)} chunks:\n")
        for i, c in enumerate(chunks):
            title = c.get("metadata", {}).get("title", "?")
            preview = c["content"][:100].replace("\n", " ") + "..."
            print(f"       [{i+1}] Score: {c['similarity']:.3f} | {title}")
            print(f"           {preview}\n")

    print("[2/2] Generating answer...")
    answer = generate_answer(query, chunks or [])
    print(f"\n  {'~'*56}")
    print(f"  HeyMaa:")
    print(f"  {'~'*56}")
    print(f"  {answer}")
    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Usage: python test_rag_v2.py "your question"')
        sys.exit(1)
    test(sys.argv[1])
