import sys, os, requests
from dotenv import load_dotenv
from supabase import create_client
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GROQ_KEY = os.getenv("GROQ_API_KEY")
EMBED_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEMINI_KEY}"
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_emb(text):
    r = requests.post(EMBED_URL, json={"model":"models/gemini-embedding-001","content":{"parts":[{"text":text}]}})
    return r.json()["embedding"]["values"]

def search(query, top_k=5):
    emb = get_emb(query)
    return sb.rpc("match_chunks", {"query_embedding":emb,"match_count":top_k,"match_threshold":0.3}).execute().data

def answer(query, chunks):
    ctx = "\n---\n".join([f"[{c.get('metadata',{}).get('title','?')}]\n{c['content']}" for c in chunks])
    r = requests.post("https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization":f"Bearer {GROQ_KEY}","Content-Type":"application/json"},
        json={"model":"llama-3.3-70b-versatile","messages":[
            {"role":"system","content":"You are HeyMaa, a warm supportive AI friend for mothers. NEVER give medical advice - redirect to doctor. Use the knowledge excerpts naturally. Respond in the same language as the question."},
            {"role":"user","content":f"Knowledge:\n{ctx}\n---\nQuestion: {query}"}
        ],"temperature":0.7,"max_tokens":800})
    return r.json()["choices"][0]["message"]["content"] if r.status_code==200 else f"Error: {r.text}"

q = sys.argv[1] if len(sys.argv)>1 else "What is this about?"
print(f"\nQ: {q}\n")
chunks = search(q)
if chunks:
    print(f"Found {len(chunks)} relevant chunks:")
    for i,c in enumerate(chunks):
        print(f"  [{i+1}] Score:{c['similarity']:.3f} | {c.get('metadata',{}).get('title','?')}")
        print(f"      {c['content'][:80]}...\n")
print("HeyMaa says:\n")
print(answer(q, chunks or []))
