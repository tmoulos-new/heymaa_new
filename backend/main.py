import os
import io
import base64
import asyncio
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ── RAG setup ─────────────────────────────────────────────────
import requests
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
EMBED_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GEMINI_API_KEY}"

sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def get_embedding(text):
    r = requests.post(EMBED_URL, json={"model": "models/gemini-embedding-001", "content": {"parts": [{"text": text}]}}, timeout=10)
    r.raise_for_status()
    return r.json()["embedding"]["values"]

def retrieve_context(query, top_k=4, threshold=0.3):
    if not sb:
        return []
    try:
        emb = get_embedding(query)
        result = sb.rpc("match_chunks", {"query_embedding": emb, "match_count": top_k, "match_threshold": threshold}).execute()
        return result.data or []
    except Exception:
        return []

def build_rag_context(chunks):
    if not chunks:
        return ""
    parts = [f"[{c.get('metadata', {}).get('title', '?')}]\n{c['content']}" for c in chunks]
    return "\n---\n".join(parts)

def _describe_child_age(birth_date_str):
    from datetime import date
    try:
        birth = date.fromisoformat(birth_date_str)
        today = date.today()
        months = (today.year - birth.year) * 12 + (today.month - birth.month)
        if today.day < birth.day:
            months -= 1
        months = max(0, months)
        if months < 1:
            days = (today - birth).days
            return f"{max(0, days)} days old"
        elif months < 24:
            return f"{months} months old"
        else:
            years = months // 12
            rem = months % 12
            return f"{years} years{f' and {rem} months' if rem else ''} old"
    except Exception:
        return "unknown age"

def build_profile_context(profile):
    if not profile:
        return ""
    from datetime import date
    lines = []

    # Collect children from new `children` list (preferred) or legacy single-child fields
    children = []
    if profile.children:
        for c in profile.children:
            if c.name:
                children.append({"name": c.name, "birthDate": c.birthDate})
    if not children and profile.childName:
        children.append({"name": profile.childName, "birthDate": profile.childBirthDate, "ageFallback": profile.childAge})

    due_date_passed = False
    if profile.dueDate:
        try:
            due = date.fromisoformat(profile.dueDate)
            today = date.today()
            days_left = (due - today).days
            gestational_days = 280 - days_left
            week = max(1, min(42, gestational_days // 7))
            if days_left > 0:
                lines.append(f"This user is currently pregnant, approximately {week} weeks pregnant. Expected due date: {profile.dueDate} ({days_left} days remaining).")
            else:
                due_date_passed = True
        except Exception:
            lines.append(f"This user is currently pregnant. Expected due date: {profile.dueDate}.")

    # If due date has passed and no child has been registered yet -> discretion mode
    if due_date_passed and not children:
        lines.append(
            "IMPORTANT - HANDLE WITH CARE: This user's expected due date has passed, but no baby has been "
            "registered in their profile yet. DO NOT proactively bring up the pregnancy, due date, birth, or "
            "ask about the baby's arrival. Do NOT assume anything about the outcome. Wait for the user to "
            "bring up the topic themselves. If they mention they have given birth and the baby is healthy, "
            "warmly congratulate them and ask for the baby's date of birth (and name, if they'd like to share it) "
            "so their profile can be updated. If they indicate difficulty, loss, or a complication, respond with "
            "warmth and care, do not proceed with any profile/baby setup, and gently suggest they reach out to "
            "their doctor or a trusted person for support if appropriate. If the user has not brought up the "
            "topic, keep greetings and proactive messages neutral and general (e.g. simply ask how they are doing today)."
        )

    # Describe all children
    for child in children:
        name = child.get("name") or "their child"
        if child.get("birthDate"):
            age_desc = _describe_child_age(child["birthDate"])
        else:
            age_desc = child.get("ageFallback") or "unknown age"
        lines.append(f"This user has a child named {name}, currently {age_desc}.")

    if len(children) > 1:
        lines.append(
            "This user has multiple children. Pay close attention to which child the user is referring to in "
            "their current message (by name or context) and respond about that specific child, not a different "
            "one or the pregnancy."
        )

    if children and profile.dueDate and not due_date_passed:
        lines.append(
            "This user has both a registered child/children AND an ongoing pregnancy. When the user refers to "
            "'the baby' or asks about development without specifying, infer from context whether they mean the "
            "born child or the pregnancy, and ask for clarification if it's ambiguous."
        )

    return "\n".join(lines)

# ── Invite Codes ──────────────────────────────────────────────
VALID_CODES = {
    "HeyMaa_CD_Test_01", "HeyMaa_CD_Test_02", "HeyMaa_CD_Test_03",
    "HeyMaa_CD_Test_04", "HeyMaa_CD_Test_05", "HeyMaa_CD_Test_06",
    "HeyMaa_CD_Test_07", "HeyMaa_CD_Test_08", "HeyMaa_CD_Test_09",
    "HeyMaa_CD_Test_10", "HeyMaa_CD_Test_11", "HeyMaa_CD_Test_12",
    "HeyMaa_CD_Test_13", "HeyMaa_CD_Test_14", "HeyMaa_CD_Test_15",
}

app = FastAPI(title="HeyMaa API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

SYSTEM_PROMPT = """You are HeyMaa, an AI companion app for pregnant women and new mothers.

LANGUAGE RULE: Respond in the SAME language as the user's CURRENT message, even if it differs from earlier messages in the conversation. If the user switches language mid-conversation, switch with them. Only if you genuinely cannot produce a reliable response in the requested language should you say so briefly and suggest the person change their app language setting (in their profile/settings) for fully consistent responses, then still attempt to answer as best you can in that language.

TONE: Professional, warm, and supportive — like a knowledgeable, caring resource, not a close personal friend. Natural conversation, no bullet points or lists unless the user asks for a structured list. Give complete answers — don't artificially cut a response short; if the topic needs more explanation, provide it in full.

PERSON: Always address the user in second person SINGULAR (εσύ/σε/σου in Greek, tu/te in Spanish/French/Portuguese/Italian, du in German, etc.). Never use plural forms (εσείς/σας, vous, Sie, usted formal plural) unless the user explicitly uses them first.

STRICTLY AVOID:
- Romantic, clingy, or overly intimate language (e.g. "I missed you", "I've been thinking about you", "my dear", terms of endearment).
- Expressions of personal longing, loneliness, or emotional dependency directed at the user.
- Excessive familiarity that would be odd between an app and a person.

SELF-REFERENCE: Avoid speaking in the first person ("I"). When referring to yourself, use third person, e.g. "HeyMaa is here to help" / "Η HeyMaa είναι εδώ για να σε βοηθήσει" rather than "I'm here to help" / "Είμαι εδώ για να σε βοηθήσω". This applies in every language. However, only mention the name "HeyMaa" in the FIRST reply of a new conversation (when there is no prior history); in later replies within the same conversation, refer to yourself only indirectly (e.g. "happy to help with that" / "ευχαρίστως") without repeating the name "HeyMaa" every time — this sounds more natural.

TOPICS: Baby development, sleep, breastfeeding, nutrition, postpartum emotions, milestones, pregnancy.

MEDICAL: For any medical concern, warmly suggest seeing a pediatrician or doctor in one sentence, in third person (e.g. "It's a good idea to check this with your doctor").

If relevant background knowledge is provided below, use it naturally to inform your answer without quoting it directly or mentioning "the knowledge base" or "context"."""

def build_system_prompt(rag_context, family_context="", memories_context=""):
    prompt = SYSTEM_PROMPT
    if family_context:
        prompt += f"\n\n--- About this user ---\n{family_context}"
    if memories_context:
        prompt += f"\n\n--- Recent memories this user has saved (use naturally if relevant, never list them all at once) ---\n{memories_context}"
    if rag_context:
        prompt += f"\n\n--- Background knowledge (use naturally, don't cite) ---\n{rag_context}"
    return prompt

COMPLEX_KEYWORDS = ["diagnosis","symptoms","emergency","medication","fever","hospital","allergy","depression","anxiety"]

def is_complex(message):
    return any(kw in message.lower() for kw in COMPLEX_KEYWORDS) or len(message) > 300

def verify_token(token: str):
    if not token or token not in VALID_CODES:
        raise HTTPException(status_code=401, detail="Invalid or missing invite code.")

def check_subscription(token: str):
    """Returns True if subscription is active. If invite_codes table/sb unavailable, defaults to active."""
    if not sb:
        return True
    try:
        result = sb.table("invite_codes").select("status").eq("code", token).execute()
        if result.data and len(result.data) > 0:
            return result.data[0].get("status") == "active"
        return True
    except Exception:
        return True

async def call_groq(message, history, system_prompt):
    from groq import Groq
    client = Groq(api_key=GROQ_API_KEY)
    messages = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=500,
    )
    return response.choices[0].message.content

async def call_gemini(message, history, system_prompt):
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(model_name="gemini-1.5-flash", system_instruction=system_prompt)
    chat_history = [{"role": "user" if h["role"]=="user" else "model", "parts": [h["content"]]} for h in history]
    chat = model.start_chat(history=chat_history)
    return chat.send_message(message).text

async def call_claude(message, history, system_prompt):
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    messages = [{"role": h["role"], "content": h["content"]} for h in history]
    messages.append({"role": "user", "content": message})
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=500,
        messages=messages
    )
    return response.content[0].text

# ── Models ────────────────────────────────────────────────────
class InviteRequest(BaseModel):
    code: str

class ChildContext(BaseModel):
    name: Optional[str] = None
    birthDate: Optional[str] = None

class MemoryContext(BaseModel):
    text: str
    date: Optional[str] = None
    ref: Optional[str] = None  # child name | "pregnancy" | family member name | None

class ProfileContext(BaseModel):
    childName: Optional[str] = None
    childAge: Optional[str] = None
    childBirthDate: Optional[str] = None
    dueDate: Optional[str] = None
    children: Optional[list[ChildContext]] = None
    pregnancyStatus: Optional[str] = None  # "active" | "awaiting_update" | "completed"

class ChatRequest(BaseModel):
    message: str
    history: list = []
    profile: Optional[ProfileContext] = None
    recentMemories: Optional[list[MemoryContext]] = None

class TTSRequest(BaseModel):
    text: str
    lang: str = "el"

class AdminOfferCreate(BaseModel):
    title: str
    body: str
    lang: str = "all"  # "all" or specific language code
    badge: Optional[str] = None  # e.g. "promo", "news", "sponsored"
    link: Optional[str] = None
    expires_at: Optional[str] = None  # ISO date string

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")

def verify_admin(x_admin_secret: Optional[str]):
    if not ADMIN_SECRET or x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

# ── Routes ────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "HeyMaa API is running!"}

@app.post("/auth/invite")
def redeem_invite(req: InviteRequest):
    if req.code not in VALID_CODES:
        raise HTTPException(status_code=401, detail="Invalid invite code.")
    return {"ok": True, "token": req.code, "subscription_active": check_subscription(req.code)}

@app.get("/auth/status")
async def auth_status(x_token: Optional[str] = Header(None)):
    verify_token(x_token)
    return {"ok": True, "subscription_active": check_subscription(x_token)}

@app.post("/chat")
async def chat(req: ChatRequest, x_token: Optional[str] = Header(None)):
    verify_token(x_token)
    if not check_subscription(x_token):
        raise HTTPException(status_code=402, detail="Subscription expired")
    complex_query = is_complex(req.message)

    rag_chunks = retrieve_context(req.message)
    rag_context = build_rag_context(rag_chunks)
    family_context = build_profile_context(req.profile)

    # Build memories context string
    memories_context = ""
    if req.recentMemories:
        parts = []
        for m in req.recentMemories[:15]:
            who = f" [{m.ref}]" if m.ref else ""
            parts.append(f"- {m.date or ''}{who}: {m.text}")
        memories_context = "\n".join(parts)

    system_prompt = build_system_prompt(rag_context, family_context, memories_context)

    reply = ""
    errors = []
    provider = ""
    if not complex_query and GROQ_API_KEY:
        try:
            reply = await call_groq(req.message, req.history, system_prompt)
            provider = "groq"
        except Exception as e:
            errors.append(str(e))
    if not reply and GEMINI_API_KEY:
        try:
            reply = await call_gemini(req.message, req.history, system_prompt)
            provider = "gemini"
        except Exception as e:
            errors.append(str(e))
    if not reply and ANTHROPIC_API_KEY:
        try:
            reply = await call_claude(req.message, req.history, system_prompt)
            provider = "claude"
        except Exception as e:
            errors.append(str(e))
    if not reply:
        raise HTTPException(status_code=500, detail=str(errors))
    return {
        "reply": reply,
        "provider": provider,
        "complex": complex_query,
        "rag_used": len(rag_chunks) > 0,
        "rag_sources": [c.get("metadata", {}).get("title", "?") for c in rag_chunks]
    }


@app.post("/tts")
async def text_to_speech(req: TTSRequest, x_token: Optional[str] = Header(None)):
    verify_token(x_token)
    try:
        import edge_tts
        voice_map = {
            "el": "el-GR-AthinaNeural",
            "en": "en-US-JennyNeural",
            "ar": "ar-SA-ZariyahNeural",
            "zh": "zh-CN-XiaoxiaoNeural",
            "es": "es-ES-ElviraNeural",
            "fr": "fr-FR-DeniseNeural",
            "ro": "ro-RO-AlinaNeural",
            "pl": "pl-PL-ZofiaNeural",
            "tr": "tr-TR-EmelNeural",
            "hi": "hi-IN-SwaraNeural",
            "ur": "ur-PK-UzmaNeural"
        }
        voice = voice_map.get(req.lang, "el-GR-AthinaNeural")
        communicate = edge_tts.Communicate(req.text, voice)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        buf.seek(0)
        audio_base64 = base64.b64encode(buf.read()).decode("utf-8")
        return {"audio": audio_base64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/offers")
async def get_offers(lang: str = "el", x_token: Optional[str] = Header(None)):
    verify_token(x_token)
    if not sb:
        return {"offers": []}
    try:
        from datetime import datetime, timezone
        result = sb.table("admin_messages").select("*").eq("active", True).order("created_at", desc=True).execute()
        now = datetime.now(timezone.utc)
        offers = []
        for row in (result.data or []):
            if row.get("expires_at"):
                try:
                    exp = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00"))
                    if exp < now:
                        continue
                except Exception:
                    pass
            if row.get("lang") not in ("all", lang):
                continue
            offers.append(row)
        return {"offers": offers}
    except Exception as e:
        return {"offers": [], "error": str(e)}

@app.post("/admin/offers")
async def create_offer(req: AdminOfferCreate, x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    if not sb:
        raise HTTPException(status_code=500, detail="Database not configured")
    try:
        data = {
            "title": req.title,
            "body": req.body,
            "lang": req.lang,
            "badge": req.badge,
            "link": req.link,
            "expires_at": req.expires_at,
            "active": True,
        }
        result = sb.table("admin_messages").insert(data).execute()
        return {"ok": True, "offer": result.data[0] if result.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/admin/offers/{offer_id}")
async def delete_offer(offer_id: str, x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    if not sb:
        raise HTTPException(status_code=500, detail="Database not configured")
    try:
        sb.table("admin_messages").update({"active": False}).eq("id", offer_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {
        "status": "ok",
        "groq": bool(GROQ_API_KEY),
        "gemini": bool(GEMINI_API_KEY),
        "claude": bool(ANTHROPIC_API_KEY)
    }
