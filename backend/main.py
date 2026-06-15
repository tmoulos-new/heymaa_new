import os
import io
import base64
import asyncio
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import FileResponse
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

LANGUAGE RULE: Respond in the SAME language as the user's CURRENT message. If the user switches language mid-conversation, switch immediately. Write as a NATIVE speaker of that language — use natural idioms, expressions, and sentence structures that a native speaker would use, not word-for-word translations from English. Dates must follow the local format and language (e.g. "14 Ιουνίου 2026" in Greek, "14 juin 2026" in French, "14 de junio de 2026" in Spanish, "2026年6月14日" in Chinese/Japanese, "١٤ يونيو ٢٠٢٦" in Arabic). Numbers, units and medical terms should also follow local conventions. Never produce text that reads like a translation — write directly in the target language with full fluency and warmth. CRITICAL: Use ONLY ONE language in your entire response — the user's language. NEVER insert words from other languages (no English, German, French, Chinese words mixed in). Every single word must be in the same language. If you don't know a specific term in the target language, describe it in that language rather than borrowing a foreign word.

TONE: Professional, warm, and supportive — like a knowledgeable, caring resource, not a close personal friend. Natural conversation flowing as prose. Never use bullet points, numbered lists, bold text (**), asterisks (*), markdown headers (#), or any formatting symbols in your response — write in clean natural prose only. Give complete answers — never artificially cut a response short.

PERSON: Always address the user in second person SINGULAR (εσύ/σε/σου in Greek, tu/te in Spanish/French/Portuguese/Italian, du in German, etc.). Never use plural forms (εσείς/σας, vous, Sie, usted formal plural) unless the user explicitly uses them first.

STRICTLY AVOID:
- Romantic, clingy, or overly intimate language (e.g. "I missed you", "I've been thinking about you", "my dear", terms of endearment).
- Expressions of personal longing, loneliness, or emotional dependency directed at the user.
- Excessive familiarity that would be odd between an app and a person.

SELF-REFERENCE: Avoid speaking in the first person ("I"). When referring to yourself, use third person, e.g. "HeyMaa is here to help" / "Η HeyMaa είναι εδώ για να σε βοηθήσει" rather than "I'm here to help" / "Είμαι εδώ για να σε βοηθήσω". This applies in every language. However, only mention the name "HeyMaa" in the FIRST reply of a new conversation (when there is no prior history); in later replies within the same conversation, refer to yourself only indirectly (e.g. "happy to help with that" / "ευχαρίστως") without repeating the name "HeyMaa" every time — this sounds more natural.

TOPICS: Baby development, sleep, breastfeeding, nutrition, postpartum emotions, milestones, pregnancy.

MEDICAL: For any medical concern, warmly suggest seeing a pediatrician or doctor in one sentence, in third person (e.g. "It's a good idea to check this with your doctor").

If relevant background knowledge is provided below, use it naturally to inform your answer without quoting it directly or mentioning "the knowledge base" or "context"."""

def build_system_prompt(rag_context, family_context="", memories_context="", docs_context="", promotion_context=""):
    prompt = SYSTEM_PROMPT
    if family_context:
        prompt += f"\n\n--- About this user ---\n{family_context}"
    if memories_context:
        prompt += f"\n\n--- Recent memories this user has saved (use naturally if relevant, never list them all at once) ---\n{memories_context}"
    if docs_context:
        prompt += f"\n\n--- Document archive (act as librarian: you know what documents exist and for whom, but NEVER read or comment on their content. Only mention their existence when naturally relevant) ---\n{docs_context}"
    if promotion_context:
        prompt += "\n\n--- Sponsored content (mention ONLY if it naturally fits the current conversation topic, in at most one brief sentence translated into the user language, ALWAYS followed by the word sponsored in parentheses) ---\n" + promotion_context
    if rag_context:
        prompt += f"\n\n--- Background knowledge (use naturally, don't cite) ---\n{rag_context}"
    return prompt

COMPLEX_KEYWORDS = ["diagnosis","symptoms","emergency","medication","fever","hospital","allergy","depression","anxiety"]

# Languages routed to Gemini first (better multilingual quality)
GEMINI_FIRST_LANGS = {"ar","zh","ja","hi","ur","bn","mr","te","fil","sw"}
# Languages routed to Claude first (complex script + nuance)
CLAUDE_FIRST_LANGS = set()  # reserved for future

import re as _re
def detect_msg_lang(message: str, profile_lang: str = "") -> str:
    if _re.search(r'[\u0600-\u06FF]', message):
        return "ur" if _re.search(r'[\u067E\u0679\u0688\u0691]', message) else "ar"
    if _re.search(r'[\u3040-\u30FF]', message): return "ja"
    if _re.search(r'[\u4E00-\u9FFF]', message): return "zh"
    if _re.search(r'[\u0980-\u09FF]', message): return "bn"
    if _re.search(r'[\u0C00-\u0C7F]', message): return "te"
    if _re.search(r'[\u0900-\u097F]', message): return profile_lang if profile_lang in ("hi","mr") else "hi"
    if _re.search(r'[\u0400-\u04FF]', message): return "ru"
    if _re.search(r'[\u0370-\u03FF\u1F00-\u1FFF]', message): return "el"
    return profile_lang or "en"

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
        max_tokens=800,
    )
    return response.choices[0].message.content

async def call_gemini(message, history, system_prompt):
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(model_name="gemini-flash-latest", system_instruction=system_prompt)
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
        max_tokens=800,
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

class DocContext(BaseModel):
    title: str
    category: Optional[str] = None
    date: Optional[str] = None
    ref: Optional[str] = None  # child name | "pregnancy" | family member name | "" (general)

class ProfileContext(BaseModel):
    childName: Optional[str] = None
    childAge: Optional[str] = None
    childBirthDate: Optional[str] = None
    dueDate: Optional[str] = None
    children: Optional[list[ChildContext]] = None
    pregnancyStatus: Optional[str] = None  # "active" | "awaiting_update" | "completed"
    lang: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: list = []
    profile: Optional[ProfileContext] = None
    recentMemories: Optional[list[MemoryContext]] = None
    recentDocs: Optional[list[DocContext]] = None

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

class ProfileSyncRequest(BaseModel):
    country: Optional[str] = None
    city: Optional[str] = None
    zip: Optional[str] = None
    child_count: Optional[int] = None
    pregnancy_active: Optional[bool] = None
    children_birthdates: Optional[list] = None
    consent_marketing: Optional[bool] = None
    consent_date: Optional[str] = None

class PromotionCreate(BaseModel):
    title: str
    body: str
    badge: Optional[str] = "sponsored"
    link: Optional[str] = None
    target_countries: Optional[list] = None
    target_cities: Optional[list] = None
    target_zips: Optional[list] = None
    child_count_min: Optional[int] = None
    child_count_max: Optional[int] = None
    target_pregnancy: Optional[bool] = None
    child_age_min_months: Optional[int] = None
    child_age_max_months: Optional[int] = None
    expires_at: Optional[str] = None

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "")

def verify_admin(x_admin_secret: Optional[str]):
    if not ADMIN_SECRET or x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

def match_promotion(token: str):
    """Return first matching active promotion for user, or None if no match/no consent."""
    if not sb:
        return None
    try:
        from datetime import date
        prof_res = sb.table("profiles").select("*").eq("token", token).execute()
        if not prof_res.data:
            return None
        prof = prof_res.data[0]
        if not prof.get("consent_marketing"):
            return None
        promo_res = sb.table("promotions").select("*").eq("active", True).order("created_at", desc=True).execute()
        today = date.today()
        user_country = prof.get("country") or ""
        user_city = (prof.get("city") or "").lower()
        user_zip = prof.get("zip") or ""
        user_child_count = prof.get("child_count") or 0
        user_pregnancy = bool(prof.get("pregnancy_active"))
        raw_dates = prof.get("children_birthdates") or []
        child_ages = []
        for bd in raw_dates:
            try:
                birth = date.fromisoformat(bd)
                m = (today.year - birth.year) * 12 + (today.month - birth.month)
                if today.day < birth.day:
                    m -= 1
                child_ages.append(max(0, m))
            except Exception:
                pass
        for p in (promo_res.data or []):
            if p.get("expires_at"):
                try:
                    if date.fromisoformat(p["expires_at"]) < today:
                        continue
                except Exception:
                    pass
            if p.get("target_countries") and user_country not in p["target_countries"]:
                continue
            if p.get("target_cities") and user_city not in [x.lower() for x in p["target_cities"]]:
                continue
            if p.get("target_zips") and user_zip not in p["target_zips"]:
                continue
            if p.get("child_count_min") is not None and user_child_count < p["child_count_min"]:
                continue
            if p.get("child_count_max") is not None and user_child_count > p["child_count_max"]:
                continue
            if p.get("target_pregnancy") is not None and user_pregnancy != p["target_pregnancy"]:
                continue
            age_min = p.get("child_age_min_months")
            age_max = p.get("child_age_max_months")
            if age_min is not None or age_max is not None:
                lo = age_min if age_min is not None else 0
                hi = age_max if age_max is not None else 9999
                if not any(lo <= a <= hi for a in child_ages):
                    continue
            return p
    except Exception:
        return None
    return None
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

@app.post("/profile/sync")
async def sync_profile(req: ProfileSyncRequest, x_token: Optional[str] = Header(None)):
    verify_token(x_token)
    if not sb:
        return {"ok": False, "error": "Database not configured"}
    try:
        data: dict = {"token": x_token}
        if req.country is not None: data["country"] = req.country
        if req.city is not None: data["city"] = req.city
        if req.zip is not None: data["zip"] = req.zip
        if req.child_count is not None: data["child_count"] = req.child_count
        if req.pregnancy_active is not None: data["pregnancy_active"] = req.pregnancy_active
        if req.children_birthdates is not None: data["children_birthdates"] = req.children_birthdates
        if req.consent_marketing is not None: data["consent_marketing"] = req.consent_marketing
        if req.consent_date is not None: data["consent_date"] = req.consent_date
        sb.table("profiles").upsert(data).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

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

    docs_context = ""
    if req.recentDocs:
        doc_parts = [
            f"- {d.title} ({d.category or 'document'}, {d.date or 'no date'}) — for: {d.ref or 'general'}"
            for d in req.recentDocs[:30]
        ]
        docs_context = "\n".join(doc_parts)
    promotion = match_promotion(x_token)
    promo_ctx = ""
    if promotion:
        promo_ctx = str(promotion.get("title","")) + ": " + str(promotion.get("body",""))
        if promotion.get("link"):
            promo_ctx += " -- " + str(promotion["link"])
    system_prompt = build_system_prompt(rag_context, family_context, memories_context, docs_context, promo_ctx)

    reply = ""
    errors = []
    provider = ""

    # Groq (Llama) handles English well but mixes languages badly in others.
    # Route only English to Groq; everything else goes to Gemini first (cleaner multilingual output).
    user_lang = (req.profile.lang if req.profile and req.profile.lang else "en")
    groq_ok = user_lang == "en"

    if groq_ok and not complex_query and GROQ_API_KEY:
        # English: Groq (fast, good quality)
        try:
            reply = await call_groq(req.message, req.history, system_prompt)
            provider = "groq"
        except Exception as e:
            errors.append(str(e))
    if not reply and not groq_ok and ANTHROPIC_API_KEY:
        # Non-English: Claude Haiku first (never mixes languages, excellent multilingual)
        try:
            reply = await call_claude(req.message, req.history, system_prompt)
            provider = "claude"
        except Exception as e:
            errors.append(str(e))
    if not reply and GEMINI_API_KEY:
        try:
            reply = await call_gemini(req.message, req.history, system_prompt)
            provider = "gemini"
        except Exception as e:
            errors.append(str(e))
    if not reply and groq_ok and ANTHROPIC_API_KEY:
        try:
            reply = await call_claude(req.message, req.history, system_prompt)
            provider = "claude"
        except Exception as e:
            errors.append(str(e))
    # Last resort: if Gemini/Claude both failed for a non-English lang, try Groq anyway
    if not reply and not groq_ok and GROQ_API_KEY:
        try:
            reply = await call_groq(req.message, req.history, system_prompt)
            provider = "groq"
        except Exception as e:
            errors.append(str(e))
    if not reply:
        raise HTTPException(status_code=500, detail=str(errors))
    if provider in USAGE_LOG:
        USAGE_LOG[provider] += 1
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


# ── Admin Panel ──────────────────────────────────────────────
import time as _time
USAGE_LOG = {"groq": 0, "gemini": 0, "claude": 0, "since": _time.time()}

# Rough cost estimates per request (avg ~600 input + 400 output tokens)
COST_PER_CALL = {"groq": 0.0, "gemini": 0.0, "claude": 0.0025}

@app.get("/admin")
def admin_page():
    import os as _os
    path = _os.path.join(_os.path.dirname(__file__), "admin.html")
    return FileResponse(path, media_type="text/html")

@app.get("/admin/health")
async def admin_health(x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    status = {}
    # Groq
    try:
        if GROQ_API_KEY:
            await call_groq("ping", [], "Reply with one word.")
            status["groq"] = {"ok": True, "msg": "online"}
        else:
            status["groq"] = {"ok": False, "msg": "no key"}
    except Exception as e:
        status["groq"] = {"ok": False, "msg": str(e)[:120]}
    # Gemini
    try:
        if GEMINI_API_KEY:
            await call_gemini("ping", [], "Reply with one word.")
            status["gemini"] = {"ok": True, "msg": "online"}
        else:
            status["gemini"] = {"ok": False, "msg": "no key"}
    except Exception as e:
        msg = str(e)
        if "quota" in msg.lower() or "429" in msg:
            status["gemini"] = {"ok": False, "msg": "quota exceeded"}
        else:
            status["gemini"] = {"ok": False, "msg": msg[:120]}
    # Claude
    try:
        if ANTHROPIC_API_KEY:
            await call_claude("ping", [], "Reply with one word.")
            status["claude"] = {"ok": True, "msg": "online"}
        else:
            status["claude"] = {"ok": False, "msg": "no key"}
    except Exception as e:
        msg = str(e)
        if "credit balance" in msg.lower():
            status["claude"] = {"ok": False, "msg": "out of credits"}
        else:
            status["claude"] = {"ok": False, "msg": msg[:120]}
    return status

@app.get("/admin/usage")
async def admin_usage(x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    est_cost = sum(USAGE_LOG[p] * COST_PER_CALL.get(p, 0) for p in ("groq","gemini","claude"))
    days = max(1, (_time.time() - USAGE_LOG["since"]) / 86400)
    return {
        "calls": {"groq": USAGE_LOG["groq"], "gemini": USAGE_LOG["gemini"], "claude": USAGE_LOG["claude"]},
        "estimated_cost_usd": round(est_cost, 4),
        "since_days": round(days, 1),
    }

@app.get("/admin/offers")
async def admin_list_offers(x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    if not sb:
        return {"offers": []}
    try:
        result = sb.table("admin_messages").select("*").eq("active", True).order("id", desc=True).execute()
        return {"offers": result.data or []}
    except Exception as e:
        return {"offers": [], "error": str(e)}

@app.post("/admin/promotions")
async def create_promotion(req: PromotionCreate, x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    if not sb:
        raise HTTPException(status_code=500, detail="Database not configured")
    try:
        data = {
            "title": req.title, "body": req.body, "badge": req.badge or "sponsored",
            "link": req.link, "target_countries": req.target_countries,
            "target_cities": req.target_cities, "target_zips": req.target_zips,
            "child_count_min": req.child_count_min, "child_count_max": req.child_count_max,
            "target_pregnancy": req.target_pregnancy,
            "child_age_min_months": req.child_age_min_months,
            "child_age_max_months": req.child_age_max_months,
            "expires_at": req.expires_at, "active": True,
        }
        result = sb.table("promotions").insert(data).execute()
        return {"ok": True, "promotion": result.data[0] if result.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/promotions")
async def list_promotions(x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    if not sb:
        return {"promotions": []}
    try:
        result = sb.table("promotions").select("*").eq("active", True).order("created_at", desc=True).execute()
        return {"promotions": result.data or []}
    except Exception as e:
        return {"promotions": [], "error": str(e)}

@app.post("/admin/promotions/preview")
async def preview_promotion(req: PromotionCreate, x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    if not sb:
        return {"count": 0, "total": 0, "error": "Database not configured"}
    try:
        from datetime import date
        result = sb.table("profiles").select("*").eq("consent_marketing", True).execute()
        profiles = result.data or []
        today = date.today()
        count = 0
        for prof in profiles:
            user_country = prof.get("country") or ""
            user_city = (prof.get("city") or "").lower()
            user_zip = prof.get("zip") or ""
            user_child_count = prof.get("child_count") or 0
            user_pregnancy = bool(prof.get("pregnancy_active"))
            raw_dates = prof.get("children_birthdates") or []
            child_ages = []
            for bd in raw_dates:
                try:
                    birth = date.fromisoformat(bd)
                    m = (today.year - birth.year) * 12 + (today.month - birth.month)
                    if today.day < birth.day:
                        m -= 1
                    child_ages.append(max(0, m))
                except Exception:
                    pass
            if req.target_countries and user_country not in req.target_countries:
                continue
            if req.target_cities and user_city not in [x.lower() for x in req.target_cities]:
                continue
            if req.target_zips and user_zip not in req.target_zips:
                continue
            if req.child_count_min is not None and user_child_count < req.child_count_min:
                continue
            if req.child_count_max is not None and user_child_count > req.child_count_max:
                continue
            if req.target_pregnancy is not None and user_pregnancy != req.target_pregnancy:
                continue
            age_min = req.child_age_min_months
            age_max = req.child_age_max_months
            if age_min is not None or age_max is not None:
                lo = age_min if age_min is not None else 0
                hi = age_max if age_max is not None else 9999
                if not any(lo <= a <= hi for a in child_ages):
                    continue
            count += 1
        return {"count": count, "total": len(profiles)}
    except Exception as e:
        return {"count": 0, "total": 0, "error": str(e)}

@app.delete("/admin/promotions/{promotion_id}")
async def delete_promotion(promotion_id: int, x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    if not sb:
        raise HTTPException(status_code=500, detail="Database not configured")
    try:
        sb.table("promotions").update({"active": False}).eq("id", promotion_id).execute()
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/promotions/audience")
async def audience_data(x_admin_secret: Optional[str] = Header(None)):
    verify_admin(x_admin_secret)
    if not sb:
        return {"countries":[],"cities":[],"zips":[],"child_counts":[],"child_ages_months":[],"pregnant_count":0,"non_pregnant_count":0,"total_consenting":0}
    try:
        from datetime import date
        result = sb.table("profiles").select("country,city,zip,child_count,children_birthdates,pregnancy_active").eq("consent_marketing", True).execute()
        profiles = result.data or []
        countries = sorted(set(p["country"] for p in profiles if p.get("country")))
        cities = sorted(set(p["city"].strip() for p in profiles if p.get("city") and p["city"].strip()))
        zips = sorted(set(p["zip"].strip() for p in profiles if p.get("zip") and p["zip"].strip()))
        child_counts = sorted(set(p["child_count"] for p in profiles if p.get("child_count") is not None))
        today = date.today()
        all_ages = set()
        for p in profiles:
            for bd in (p.get("children_birthdates") or []):
                try:
                    birth = date.fromisoformat(bd)
                    m = (today.year - birth.year) * 12 + (today.month - birth.month)
                    if today.day < birth.day:
                        m -= 1
                    all_ages.add(max(0, m))
                except Exception:
                    pass
        pregnant_count = sum(1 for p in profiles if p.get("pregnancy_active"))
        return {
            "countries": countries,
            "cities": cities,
            "zips": zips,
            "child_counts": child_counts,
            "child_ages_months": sorted(all_ages),
            "pregnant_count": pregnant_count,
            "non_pregnant_count": len(profiles) - pregnant_count,
            "total_consenting": len(profiles),
        }
    except Exception as e:
        return {"countries":[],"cities":[],"zips":[],"child_counts":[],"child_ages_months":[],"error":str(e)}