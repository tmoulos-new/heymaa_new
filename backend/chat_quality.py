"""Chat quality loop: rule checks, optional LLM judge, health score, bad-reply queue."""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

TURNS_TABLE = "chat_turns"
FEEDBACK_TABLE = "chat_feedback"
REVIEWS_TABLE = "chat_quality_reviews"

_LOCAL_FIND_RE = re.compile(
    r"(βρες|βρείτε|κοντά|περιοχ|ελληνικ|athens|athen|near|find.*(doctor|pediatric|clinic)|"
    r"παιδιατρ|παιδίατρ|γιατρ\w*|μαια|μαία|φαρμακ)",
    re.I | re.U,
)
_OVER_REFUSE_RE = re.compile(
    r"(δεν έχω πρόσβαση|δεν έχω λίστα|δεν διαθέτω λίστα|no access to (a )?list|"
    r"i don'?t have (access|a list))",
    re.I | re.U,
)
_HALLUCINATION_RE = re.compile(
    r"(δικαστηρ|court network|δίκτυο του δικασ|ministry of magic)",
    re.I | re.U,
)
_MIXED_LANG_RE = re.compile(
    r"[\u0370-\u03FF\u1F00-\u1FFF].*\b(sleep|nutrition|development|breastfeed|pregnancy)\b|"
    r"\b(sleep|nutrition)\b.*[\u0370-\u03FF]",
    re.I | re.U,
)
_MEDICAL_ADVICE_RE = re.compile(
    r"(πάρε|δώσε|δώσε του|take \d|dosage|δοσολογ|συνταγ|diagnose|διάγνωσ|"
    r"antibio|αντιβιο)",
    re.I | re.U,
)

JUDGE_SYSTEM = """You are a quality judge for HeyMaa, an AI helper for mothers (not a doctor).
Score the assistant reply 0-100 for the user message.
Return ONLY compact JSON:
{"score":0-100,"tags":["tag"],"summary":"one sentence","proposal":"one concrete fix"}
Tags from: helpful, unhelpful, over_refusal, local_discovery, hallucination, medical_advice, language_mix, too_short, off_brand, unsafe, good.
Be strict on invented clinics/names, nonsense referrals, and refusing local "find a professional near X" without practical next steps."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _table_missing(err: Exception) -> bool:
    msg = str(err).lower()
    return "does not exist" in msg or "42p01" in msg


def truncate(text: str, n: int = 2000) -> str:
    t = (text or "").strip()
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


def rule_based_review(user_message: str, assistant_reply: str) -> dict:
    """Cheap deterministic checks. Returns score/tags/summary/proposal."""
    um = user_message or ""
    ar = assistant_reply or ""
    tags: list[str] = []
    deductions = 0
    proposals: list[str] = []

    if not ar.strip():
        return {
            "score": 0,
            "tags": ["unhelpful", "too_short"],
            "summary": "Empty assistant reply.",
            "proposal": "Investigate provider failure; never return blank content to the user.",
            "source": "rules",
        }

    local_ask = bool(_LOCAL_FIND_RE.search(um))
    if local_ask and _OVER_REFUSE_RE.search(ar):
        tags.extend(["over_refusal", "local_discovery", "unhelpful"])
        deductions += 45
        proposals.append(
            "Add LOCAL HELP rule: for find-a-professional near a place, do not invent names; "
            "give practical next steps (Maps/search, ΕΟΠΥΥ, ask midwife/GP) plus brief medical disclaimer."
        )

    if _HALLUCINATION_RE.search(ar):
        tags.append("hallucination")
        deductions += 50
        proposals.append("Ban nonsense referrals (e.g. court networks); stay in parenting/local-help domain.")

    if _MIXED_LANG_RE.search(ar):
        tags.append("language_mix")
        deductions += 30
        proposals.append("Enforce single-language replies matching the user message.")

    if local_ask and len(ar) < 40:
        tags.append("too_short")
        deductions += 15
        proposals.append("Allow slightly longer replies for local-discovery asks.")

    # Medical advice risk on health symptom asks
    if re.search(r"(πυρετ|fever|εξάνθη|rash|πόνο|pain|συμπτωμ)", um, re.I) and _MEDICAL_ADVICE_RE.search(ar):
        tags.append("medical_advice")
        deductions += 40
        proposals.append("Keep medical boundary: refer to doctor/pharmacist; no treatment instructions.")

    if not tags:
        # Mild heuristic: very short reply to long question
        if len(um) > 80 and len(ar) < 50:
            tags.append("too_short")
            deductions += 20
            proposals.append("Ensure complete answers for substantive questions.")
        else:
            tags.append("good")
            return {
                "score": 88,
                "tags": tags,
                "summary": "No hard rule failures detected.",
                "proposal": "",
                "source": "rules",
            }

    score = max(0, min(100, 100 - deductions))
    summary = "Rule findings: " + ", ".join(sorted(set(tags)))
    proposal = " ".join(proposals)[:800]
    return {
        "score": score,
        "tags": sorted(set(tags)),
        "summary": summary,
        "proposal": proposal,
        "source": "rules",
    }


def compute_health_score(
    *,
    up: int,
    down: int,
    auto_fail: int,
    reviewed: int,
    rule_hits: int,
) -> dict:
    """Composite 0–100 health score for a window."""
    rated = up + down
    down_rate = (down / rated) if rated else 0.0
    up_rate = (up / rated) if rated else 0.0
    fail_rate = (auto_fail / reviewed) if reviewed else 0.0
    # rule_hits counted inside reviewed fails usually; keep mild penalty if present
    hit_rate = min(1.0, rule_hits / max(reviewed, 1)) if reviewed else 0.0

    score = 100.0
    score -= 40.0 * down_rate
    score -= 35.0 * fail_rate
    score -= 15.0 * hit_rate
    score += 10.0 * up_rate
    score = max(0.0, min(100.0, round(score, 1)))

    sample = rated + reviewed
    confidence = "low" if sample < 20 else ("medium" if sample < 80 else "high")
    return {
        "score": score,
        "confidence": confidence,
        "sample_size": sample,
        "down_rate": round(down_rate, 4),
        "up_rate": round(up_rate, 4),
        "auto_fail_rate": round(fail_rate, 4),
        "formula_note": (
            "100 − 40×down_rate − 35×auto_fail_rate − 15×rule_hit_rate + 10×up_rate "
            "(capped 0–100)."
        ),
    }


def persist_turn(
    sb,
    *,
    message_id: str,
    user_id: Optional[str],
    user_message: str,
    assistant_reply: str,
    lang: Optional[str] = None,
    provider: Optional[str] = None,
    needs_rag: Optional[bool] = None,
    request_id: Optional[str] = None,
    meta: Optional[dict] = None,
) -> bool:
    if not sb or not message_id:
        return False
    row = {
        "message_id": message_id,
        "user_id": user_id,
        "user_message": truncate(user_message, 2500),
        "assistant_reply": truncate(assistant_reply, 4000),
        "lang": lang,
        "provider": provider,
        "needs_rag": needs_rag,
        "request_id": request_id or message_id,
        "meta": meta or {},
    }
    try:
        sb.table(TURNS_TABLE).upsert(row, on_conflict="message_id").execute()
        return True
    except Exception as e:
        if _table_missing(e):
            return False
        return False


def upsert_feedback(
    sb,
    *,
    message_id: str,
    user_id: Optional[str],
    vote: str,
    reason: Optional[str] = None,
) -> dict:
    vote = (vote or "").lower().strip()
    if vote not in ("up", "down"):
        raise ValueError("vote must be up or down")
    if not message_id:
        raise ValueError("message_id required")
    row = {
        "message_id": message_id,
        "user_id": user_id,
        "vote": vote,
        "reason": truncate(reason or "", 200) or None,
        "created_at": _now().isoformat(),
    }
    try:
        if user_id:
            existing = (
                sb.table(FEEDBACK_TABLE)
                .select("id")
                .eq("message_id", message_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if existing.data:
                sb.table(FEEDBACK_TABLE).update(
                    {"vote": vote, "reason": row["reason"], "created_at": row["created_at"]}
                ).eq("id", existing.data[0]["id"]).execute()
                return {"ok": True, "updated": True}
        sb.table(FEEDBACK_TABLE).insert(row).execute()
        return {"ok": True, "updated": False}
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError(
                "chat_feedback table missing — run backend/migrations/chat_quality.sql"
            ) from e
        raise


def save_review(
    sb,
    *,
    message_id: str,
    score: int,
    tags: list[str],
    summary: str,
    proposal: str,
    source: str = "auto",
    status: str = "open",
    proposal_bundle: Optional[dict] = None,
) -> Optional[dict]:
    if not sb or not message_id:
        return None
    # Only enqueue clearly weak replies into open queue; still store good samples lightly
    if score >= 75 and status == "open":
        status = "dismissed"  # keep record but out of bad queue
        if not proposal:
            proposal = ""
    # Pack structured proposal into summary trail when bundle present (no schema migration)
    proposal_out = truncate(proposal or "", 1000)
    if proposal_bundle:
        try:
            extra = json.dumps(proposal_bundle, ensure_ascii=False)
            # Keep human proposal first; bundle stored in tags via meta-like encoding in proposal footer
            if len(proposal_out) + len(extra) < 950:
                proposal_out = f"{proposal_out}\n\n[[bundle]]{extra}"
        except Exception:
            pass
    row = {
        "message_id": message_id,
        "score": int(max(0, min(100, score))),
        "tags": list(tags or []),
        "summary": truncate(summary or "", 600),
        "proposal": proposal_out,
        "status": status if status in ("open", "fixed", "dismissed") else "open",
        "source": source if source in ("auto", "rules", "admin") else "auto",
        "updated_at": _now().isoformat(),
    }
    try:
        # One latest review per message: update if exists
        existing = (
            sb.table(REVIEWS_TABLE)
            .select("id")
            .eq("message_id", message_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if existing.data:
            sb.table(REVIEWS_TABLE).update(row).eq("id", existing.data[0]["id"]).execute()
            row["id"] = existing.data[0]["id"]
            return row
        res = sb.table(REVIEWS_TABLE).insert(row).execute()
        return (res.data or [row])[0]
    except Exception as e:
        if _table_missing(e):
            return None
        return None


def parse_proposal_bundle(proposal: Optional[str]) -> tuple[str, Optional[dict]]:
    text = proposal or ""
    if "[[bundle]]" not in text:
        return text, None
    human, _, raw = text.partition("[[bundle]]")
    try:
        return human.strip(), json.loads(raw)
    except Exception:
        return text, None


def build_proposal_bundle(tags: list[str], proposal: str) -> dict:
    """Structured fix hints: prompt diff, RAG gap, product note."""
    tagset = set(tags or [])
    prompt_diff = None
    rag_gap = None
    product = None
    if tagset & {"local_discovery", "over_refusal", "hallucination"}:
        prompt_diff = (
            "Ensure LOCAL HELP rule is active: find-a-professional near place → "
            "no invented names; Maps/ΕΟΠΥΥ/midwife referral; short medical disclaimer."
        )
        rag_gap = (
            "Optional RAG seed: Greece local care how-to (how to search pediatricians, "
            "ΕΟΠΥΥ, when to call 166) — not a clinic directory."
        )
        product = "Consider in-app deep link tips for Family → Documents (save pediatrician contact)."
    if "medical_advice" in tagset:
        prompt_diff = (
            (prompt_diff or "")
            + " Reinforce MEDICAL boundary: never dosage/antibiotics; refer to doctor/pharmacist."
        ).strip()
    if "language_mix" in tagset:
        prompt_diff = (
            (prompt_diff or "")
            + " Reinforce single-language rule; scrub English topic labels from Greek replies."
        ).strip()
    if "too_short" in tagset:
        product = (product or "") + " Allow 3 sentences for local-discovery / how-to intents."
        product = product.strip()
    return {
        "text": proposal or "",
        "prompt_diff": prompt_diff,
        "rag_gap": rag_gap,
        "product": product or None,
    }


def merge_reviews(rules: dict, llm: Optional[dict]) -> dict:
    if not llm:
        out = dict(rules)
        out["proposal_bundle"] = build_proposal_bundle(
            list(out.get("tags") or []), str(out.get("proposal") or "")
        )
        return out
    tags = sorted(set(list(rules.get("tags") or []) + list(llm.get("tags") or [])) - {""})
    score = min(int(rules.get("score") or 100), int(llm.get("score") or 100))
    # Prefer lower-score narrative
    if int(llm.get("score") or 100) <= int(rules.get("score") or 100):
        summary = str(llm.get("summary") or rules.get("summary") or "")
        proposal = str(llm.get("proposal") or rules.get("proposal") or "")
    else:
        summary = str(rules.get("summary") or llm.get("summary") or "")
        proposal = str(rules.get("proposal") or llm.get("proposal") or "")
    if rules.get("proposal") and llm.get("proposal") and rules["proposal"] != llm["proposal"]:
        proposal = f"{rules['proposal']} | LLM: {llm['proposal']}"
    out = {
        "score": score,
        "tags": tags,
        "summary": summary,
        "proposal": proposal,
        "source": "auto" if llm else str(rules.get("source") or "rules"),
    }
    out["proposal_bundle"] = build_proposal_bundle(tags, proposal)
    return out


def judge_via_groq_sync(
    api_key: str,
    user_message: str,
    assistant_reply: str,
    *,
    model: str = "llama-3.1-8b-instant",
) -> Optional[dict]:
    """Synchronous Groq JSON judge (best-effort)."""
    if not api_key:
        return None
    try:
        import httpx
    except ImportError:
        return None
    payload = {
        "model": model,
        "temperature": 0,
        "max_tokens": 280,
        "messages": [
            {"role": "system", "content": JUDGE_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"USER:\n{truncate(user_message, 1200)}\n\n"
                    f"ASSISTANT:\n{truncate(assistant_reply, 1500)}"
                ),
            },
        ],
    }
    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if res.status_code >= 400:
                return None
            data = res.json()
            raw = (
                ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
            ).strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        parsed = json.loads(raw)
        score = int(parsed.get("score", 50))
        tags = [str(t) for t in (parsed.get("tags") or [])][:8]
        return {
            "score": max(0, min(100, score)),
            "tags": tags,
            "summary": truncate(str(parsed.get("summary") or ""), 400),
            "proposal": truncate(str(parsed.get("proposal") or ""), 800),
            "source": "auto",
        }
    except Exception:
        return None


def review_and_store(
    sb,
    turn: dict,
    *,
    force_open: bool = False,
    use_llm: bool = True,
    groq_api_key: Optional[str] = None,
) -> dict:
    """Rules first; LLM judge when score looks weak or use_llm forced on fails."""
    rules = rule_based_review(turn.get("user_message") or "", turn.get("assistant_reply") or "")
    llm = None
    if use_llm and groq_api_key and (
        force_open or int(rules.get("score") or 100) < 85 or "good" not in (rules.get("tags") or [])
    ):
        # Skip LLM for clearly good short greetings
        if "good" in (rules.get("tags") or []) and int(rules.get("score") or 0) >= 85:
            llm = None
        else:
            llm = judge_via_groq_sync(
                groq_api_key,
                turn.get("user_message") or "",
                turn.get("assistant_reply") or "",
            )
    result = merge_reviews(rules, llm)
    status = "open"
    if int(result["score"]) >= 75 and not force_open:
        status = "dismissed"
    elif int(result["score"]) < 75:
        status = "open"
    saved = save_review(
        sb,
        message_id=str(turn.get("message_id") or ""),
        score=int(result["score"]),
        tags=list(result.get("tags") or []),
        summary=str(result.get("summary") or ""),
        proposal=str(result.get("proposal") or ""),
        source=str(result.get("source") or "rules"),
        status=status,
        proposal_bundle=result.get("proposal_bundle"),
    )
    result["saved"] = bool(saved)
    result["status"] = status
    result["llm_used"] = bool(llm)
    return result


def review_turn_rules_and_maybe_store(sb, turn: dict, *, force_open: bool = False) -> dict:
    """Backward-compatible alias (rules only)."""
    return review_and_store(sb, turn, force_open=force_open, use_llm=False)


def rejudge_message(sb, message_id: str, *, groq_api_key: Optional[str] = None) -> dict:
    if not sb or not message_id:
        raise ValueError("message_id required")
    try:
        res = (
            sb.table(TURNS_TABLE)
            .select("message_id,user_message,assistant_reply")
            .eq("message_id", message_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError("chat_turns table missing") from e
        raise
    if not res.data:
        raise ValueError("turn not found")
    turn = res.data[0]
    return review_and_store(
        sb, turn, force_open=True, use_llm=True, groq_api_key=groq_api_key
    )


def build_preference_export(sb, *, days: int = 30, limit: int = 500) -> dict:
    """Pairs for future preference/fine-tune training (thumbs + open fails)."""
    days = max(7, min(90, int(days or 30)))
    limit = max(10, min(2000, int(limit or 500)))
    since = (_now() - timedelta(days=days)).isoformat()
    if not sb:
        return {"ok": False, "pairs": [], "note": "Database not configured"}
    try:
        feedback = _paginate_since(
            sb, FEEDBACK_TABLE, "message_id,vote,reason,created_at", since
        )
        turns = _paginate_since(
            sb,
            TURNS_TABLE,
            "message_id,user_message,assistant_reply,lang,created_at",
            since,
        )
    except Exception as e:
        if _table_missing(e):
            return {
                "ok": False,
                "pairs": [],
                "note": "Run backend/migrations/chat_quality.sql",
            }
        return {"ok": False, "pairs": [], "note": str(e)}
    turns_by_id = {str(t.get("message_id")): t for t in turns if t.get("message_id")}
    pairs = []
    for f in feedback:
        turn = turns_by_id.get(str(f.get("message_id")))
        if not turn:
            continue
        pairs.append(
            {
                "message_id": f.get("message_id"),
                "vote": f.get("vote"),
                "reason": f.get("reason"),
                "lang": turn.get("lang"),
                "prompt": turn.get("user_message"),
                "response": turn.get("assistant_reply"),
                "created_at": f.get("created_at"),
            }
        )
        if len(pairs) >= limit:
            break
    return {
        "ok": True,
        "days": days,
        "count": len(pairs),
        "format": "preference_v1",
        "note": (
            "Use thumbs-down rows as rejected responses; thumbs-up as preferred. "
            "Fine-tune / DPO only when you have enough volume — prefer prompt+RAG fixes first."
        ),
        "pairs": pairs,
    }


def update_review_status(
    sb,
    review_id: str,
    *,
    status: str,
    admin_note: Optional[str] = None,
) -> dict:
    if status not in ("open", "fixed", "dismissed"):
        raise ValueError("invalid status")
    fields: dict[str, Any] = {"status": status, "updated_at": _now().isoformat()}
    if admin_note is not None:
        fields["admin_note"] = truncate(admin_note, 1000)
    try:
        sb.table(REVIEWS_TABLE).update(fields).eq("id", review_id).execute()
        return {"ok": True, **fields, "id": review_id}
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError("chat_quality_reviews table missing") from e
        raise


def _paginate_since(sb, table: str, columns: str, since_iso: str, *, order_col: str = "created_at"):
    rows: list = []
    offset = 0
    page = 1000
    while offset < 30000:
        end = offset + page - 1
        res = (
            sb.table(table)
            .select(columns)
            .gte(order_col, since_iso)
            .order(order_col, desc=True)
            .range(offset, end)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return rows


def build_quality_dashboard(sb, *, days: int = 30) -> dict:
    days = max(7, min(90, int(days or 30)))
    now = _now()
    since = (now - timedelta(days=days)).isoformat()
    notes: list[str] = []

    if not sb:
        return _empty_dashboard(days, notes=["Database not configured"])

    try:
        turns = _paginate_since(
            sb,
            TURNS_TABLE,
            "message_id,user_id,user_message,assistant_reply,lang,provider,needs_rag,created_at",
            since,
        )
    except Exception as e:
        if _table_missing(e):
            return _empty_dashboard(
                days,
                notes=["Run backend/migrations/chat_quality.sql in Supabase"],
            )
        notes.append(f"turns: {e}")
        turns = []

    try:
        feedback = _paginate_since(
            sb, FEEDBACK_TABLE, "message_id,vote,reason,created_at,user_id", since
        )
    except Exception as e:
        notes.append(f"feedback: {e}")
        feedback = []

    try:
        reviews = _paginate_since(
            sb,
            REVIEWS_TABLE,
            "id,message_id,score,tags,summary,proposal,status,source,admin_note,created_at,updated_at",
            since,
        )
    except Exception as e:
        notes.append(f"reviews: {e}")
        reviews = []

    up = sum(1 for f in feedback if f.get("vote") == "up")
    down = sum(1 for f in feedback if f.get("vote") == "down")
    open_reviews = [r for r in reviews if r.get("status") == "open"]
    auto_fail = sum(1 for r in reviews if int(r.get("score") or 0) < 75)
    rule_hits = sum(1 for r in reviews if r.get("source") == "rules" and int(r.get("score") or 0) < 75)
    health = compute_health_score(
        up=up,
        down=down,
        auto_fail=auto_fail,
        reviewed=len(reviews),
        rule_hits=rule_hits,
    )

    tag_counter: Counter = Counter()
    for r in open_reviews:
        for t in r.get("tags") or []:
            if t and t != "good":
                tag_counter[str(t)] += 1

    # Attach turn text to open reviews
    turns_by_id = {str(t.get("message_id")): t for t in turns if t.get("message_id")}
    bad_queue = []
    for r in sorted(open_reviews, key=lambda x: (int(x.get("score") or 0), x.get("created_at") or "")):
        turn = turns_by_id.get(str(r.get("message_id"))) or {}
        human_prop, bundle = parse_proposal_bundle(r.get("proposal"))
        bad_queue.append(
            {
                **r,
                "proposal": human_prop,
                "proposal_bundle": bundle or build_proposal_bundle(
                    list(r.get("tags") or []), human_prop
                ),
                "user_message": turn.get("user_message"),
                "assistant_reply": turn.get("assistant_reply"),
                "lang": turn.get("lang"),
                "provider": turn.get("provider"),
            }
        )

    # Daily series
    turns_by_day: dict[str, float] = defaultdict(float)
    down_by_day: dict[str, float] = defaultdict(float)
    for t in turns:
        dt = _parse_dt(t.get("created_at"))
        if dt:
            turns_by_day[dt.date().isoformat()] += 1
    for f in feedback:
        if f.get("vote") != "down":
            continue
        dt = _parse_dt(f.get("created_at"))
        if dt:
            down_by_day[dt.date().isoformat()] += 1

    def fill_series(values: dict[str, float]) -> list[dict]:
        out = []
        end = now.date()
        start = end - timedelta(days=days - 1)
        cur = start
        while cur <= end:
            key = cur.isoformat()
            out.append({"date": key, "value": float(values.get(key) or 0)})
            cur += timedelta(days=1)
        return out

    proposals = []
    for r in bad_queue[:20]:
        bundle = r.get("proposal_bundle") or {}
        if r.get("proposal") or bundle.get("prompt_diff") or bundle.get("rag_gap"):
            proposals.append(
                {
                    "review_id": r.get("id"),
                    "message_id": r.get("message_id"),
                    "score": r.get("score"),
                    "tags": r.get("tags") or [],
                    "proposal": r.get("proposal"),
                    "summary": r.get("summary"),
                    "prompt_diff": bundle.get("prompt_diff"),
                    "rag_gap": bundle.get("rag_gap"),
                    "product": bundle.get("product"),
                }
            )

    try:
        from .chat_quality_golden import run_golden_suite
    except ImportError:
        from chat_quality_golden import run_golden_suite
    golden = run_golden_suite()

    return {
        "ok": True,
        "days": days,
        "generated_at": now.isoformat(),
        "notes": notes,
        "health": health,
        "kpis": {
            "turns": len(turns),
            "thumbs_up": up,
            "thumbs_down": down,
            "rated": up + down,
            "reviews": len(reviews),
            "open_bad": len(open_reviews),
            "auto_fail": auto_fail,
        },
        "top_tags": [{"tag": k, "count": v} for k, v in tag_counter.most_common(12)],
        "series": {
            "turns": fill_series(turns_by_day),
            "thumbs_down": fill_series(down_by_day),
        },
        "bad_queue": bad_queue[:50],
        "proposals": proposals,
        "golden": {
            "ok": golden.get("ok"),
            "passed": golden.get("passed"),
            "failed": golden.get("failed"),
            "total": golden.get("total"),
            "cases": golden.get("cases"),
        },
        "migration_hint": (
            None
            if turns or feedback or reviews or not notes
            else "Run backend/migrations/chat_quality.sql then send a few chat messages."
        ),
    }


def _empty_dashboard(days: int, notes: list[str]) -> dict:
    try:
        from .chat_quality_golden import run_golden_suite
    except ImportError:
        from chat_quality_golden import run_golden_suite
    try:
        golden = run_golden_suite()
    except Exception:
        golden = {"ok": False, "passed": 0, "failed": 0, "total": 0, "cases": []}
    now = _now()
    empty_series = []
    end = now.date()
    start = end - timedelta(days=max(1, days) - 1)
    cur = start
    while cur <= end:
        empty_series.append({"date": cur.isoformat(), "value": 0.0})
        cur += timedelta(days=1)
    return {
        "ok": True,
        "days": days,
        "generated_at": now.isoformat(),
        "notes": notes,
        "health": compute_health_score(up=0, down=0, auto_fail=0, reviewed=0, rule_hits=0),
        "kpis": {
            "turns": 0,
            "thumbs_up": 0,
            "thumbs_down": 0,
            "rated": 0,
            "reviews": 0,
            "open_bad": 0,
            "auto_fail": 0,
        },
        "top_tags": [],
        "series": {"turns": empty_series, "thumbs_down": empty_series},
        "bad_queue": [],
        "proposals": [],
        "golden": {
            "ok": golden.get("ok"),
            "passed": golden.get("passed"),
            "failed": golden.get("failed"),
            "total": golden.get("total"),
            "cases": golden.get("cases") or [],
        },
        "migration_hint": "Run backend/migrations/chat_quality.sql in Supabase, then send a few chat messages.",
    }


async def maybe_llm_judge(
    user_message: str,
    assistant_reply: str,
    *,
    call_llm=None,
) -> Optional[dict]:
    """Optional LLM judge. call_llm(system, user) -> str. Soft-fails."""
    if not call_llm:
        return None
    user = (
        f"USER:\n{truncate(user_message, 1200)}\n\nASSISTANT:\n{truncate(assistant_reply, 1500)}"
    )
    try:
        raw = await call_llm(JUDGE_SYSTEM, user)
        text = (raw or "").strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        data = json.loads(text)
        score = int(data.get("score", 50))
        tags = [str(t) for t in (data.get("tags") or [])][:8]
        return {
            "score": max(0, min(100, score)),
            "tags": tags,
            "summary": truncate(str(data.get("summary") or ""), 400),
            "proposal": truncate(str(data.get("proposal") or ""), 800),
            "source": "auto",
        }
    except Exception:
        return None
