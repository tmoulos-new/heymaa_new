"""
HeyMaa RAG Test Script
Query the knowledge base and see AI-augmented answers.

Usage:
  python test_rag.py "your question here"
"""
import sys
import os
from dotenv import load_dotenv

load_dotenv()

import google.generativeai as genai
from supabase import create_client

# ── Config ──
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")

EMBED_MODEL = "models/gemini-embedding-001"

# ── Init ──
sb = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_KEY)


def get_query_embedding(text: str) -> list[float]:
    """Get embedding for a search query."""
    result = genai.embed_content(
        model=EMBED_MODEL,
        content=text,
        task_type="retrieval_query"
    )
    return result["embedding"]


def search_knowledge(query: str, top_k: int = 5) -> list[dict]:
    """Search for relevant chunks in the knowledge base."""
    embedding = get_query_embedding(query)

    result = sb.rpc("match_chunks", {
        "query_embedding": embedding,
        "match_count": top_k,
        "match_threshold": 0.3
    }).execute()

    return result.data


def generate_answer(query: str, chunks: list[dict]) -> str:
    """Generate an AI answer using retrieved chunks as context."""
    import requests

    context = "\n\n---\n\n".join([
        f"[Source: {c.get('metadata', {}).get('title', 'Unknown')}]\n{c['content']}"
        for c in chunks
    ])

    system_prompt = """You are HeyMaa, a warm and supportive AI companion for mothers.
You are like a trusted, non-judgmental friend. You NEVER give medical advice - always
redirect to a doctor or pharmacist for health concerns.

Use the following knowledge base excerpts to inform your answer.
Do not quote them directly - weave the information naturally into your response.
If the excerpts are not relevant, answer from general knowledge.
Respond in the same language as the question."""

    user_prompt = f"""Knowledge base context:
{context}

---

Mother's question: {query}"""

    # Use Groq for fast response
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {GROQ_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7,
            "max_tokens": 800
        }
    )

    if resp.status_code == 200:
        return resp.json()["choices"][0]["message"]["content"]
    else:
        return f"AI Error: {resp.status_code} - {resp.text}"


def test_query(query: str):
    """Full RAG test: search + generate."""
    print(f"\n{'='*60}")
    print(f"  HeyMaa RAG Test")
    print(f"{'='*60}")
    print(f"  Question: {query}")
    print()

    # Search
    print("[1/2] Searching knowledge base...")
    chunks = search_knowledge(query)

    if not chunks:
        print("       No relevant chunks found.")
        print("       (The AI will answer from general knowledge)")
        chunks = []
    else:
        print(f"       Found {len(chunks)} relevant chunks:\n")
        for i, c in enumerate(chunks):
            score = f"{c['similarity']:.3f}"
            title = c.get("metadata", {}).get("title", "Unknown")
            preview = c["content"][:120].replace("\n", " ") + "..."
            print(f"       [{i+1}] Score: {score} | Source: {title}")
            print(f"           {preview}")
            print()

    # Generate
    print("[2/2] Generating AI answer...")
    answer = generate_answer(query, chunks)
    print(f"\n  {'~'*56}")
    print(f"  HeyMaa says:")
    print(f"  {'~'*56}")
    print(f"  {answer}")
    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_rag.py \"your question here\"")
        print()
        print("Examples:")
        print('  python test_rag.py "What should I expect in the 6th month?"')
        print('  python test_rag.py "How can I help my baby sleep?"')
        sys.exit(1)

    query = sys.argv[1]
    test_query(query)
