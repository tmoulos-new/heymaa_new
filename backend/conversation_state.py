"""Lightweight conversation state for HeyMaa continuity (v1).

Rule-based updates — no extra LLM call. Application remains source of truth;
the model only receives a compact summary for the next turn.
"""
from __future__ import annotations

import re
from typing import Any, Optional

_MAX_LIST = 8
_MAX_ITEM_CHARS = 160
_MAX_TOPIC_CHARS = 120

_CORRECTION_RE = re.compile(
    r"(με\s+μπέρδεψες|με\s+μπερδεψες|δεν\s+εννοούσα|δεν\s+εννοουσα|"
    r"δεν\s+κατάλαβες|δεν\s+καταλαβες|αυτό\s+δεν\s+έχει\s+σχέση|"
    r"αυτο\s+δεν\s+εχει\s+σχεση|τι\s+σχέση\s+έχει|τι\s+σχεση\s+εχει|"
    r"\byou\s+(misunderstood|confused)\b|\bi\s+didn'?t\s+mean\b|"
    r"\bthat'?s\s+not\s+what\s+i\s+meant\b|\bwrong\b.*\bmeant\b)",
    re.I | re.U,
)

_REJECTION_RE = re.compile(
    r"(δεν\s+(θέλει|θελει|δουλεύει|δουλευει|βοήθησε|βοηθησε)|"
    r"δεν\s+το\s+(δοκίμασα|δοκιμασα)|αυτό\s+δεν\s+(ταιριάζει|ταιριαζει)|"
    r"όχι\s+μουσική|οχι\s+μουσικη|"
    r"\b(didn'?t\s+work|doesn'?t\s+work|won'?t\s+work|not\s+suitable|"
    r"doesn'?t\s+help|already\s+tried|tried\s+that)\b)",
    re.I | re.U,
)

_TOPIC_HINT_RE = re.compile(
    r"\b(ύπν|υπν|κοιμ|bedtime|sleep|θηλασμ|breastfeed|διατροφ|nutrition|"
    r"στερε|solid|πυρετ|fever|εξάνθη|rash|εγκυμοσ|pregnan|ορόσημ|milestone|"
    r"σχολ|school|άγχ|stress|κουρασ|tired)\w*",
    re.I | re.U,
)


def empty_conversation_state() -> dict[str, Any]:
    return {
        "current_topic": None,
        "current_concern": None,
        "important_facts": [],
        "advice_given": [],
        "rejected_advice": [],
        "user_corrections": [],
        "unresolved_questions": [],
        "emotional_context": None,
    }


def _clip(text: Any, limit: int = _MAX_ITEM_CHARS) -> str:
    s = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(s) <= limit:
        return s
    return s[: limit - 1].rstrip() + "…"


def _uniq_list(items: list[str], limit: int = _MAX_LIST) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in items:
        item = _clip(raw)
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= limit:
            break
    return out


def normalize_conversation_state(raw: Any) -> dict[str, Any]:
    base = empty_conversation_state()
    if not isinstance(raw, dict):
        return base
    topic = _clip(raw.get("current_topic"), _MAX_TOPIC_CHARS) or None
    concern = _clip(raw.get("current_concern"), _MAX_TOPIC_CHARS) or None
    emotion = _clip(raw.get("emotional_context"), 40) or None
    base["current_topic"] = topic
    base["current_concern"] = concern
    base["emotional_context"] = emotion
    for key in (
        "important_facts",
        "advice_given",
        "rejected_advice",
        "user_corrections",
        "unresolved_questions",
    ):
        val = raw.get(key)
        if isinstance(val, list):
            base[key] = _uniq_list([str(x) for x in val])
        elif isinstance(val, str) and val.strip():
            base[key] = [_clip(val)]
    return base


def format_conversation_state_for_prompt(state: dict[str, Any] | None) -> str:
    st = normalize_conversation_state(state or {})
    lines: list[str] = []
    if st.get("current_topic"):
        lines.append(f"Topic: {st['current_topic']}")
    if st.get("current_concern"):
        lines.append(f"Current concern: {st['current_concern']}")
    if st.get("emotional_context"):
        lines.append(f"Emotional tone: {st['emotional_context']}")
    for label, key in (
        ("Important facts", "important_facts"),
        ("Advice already given", "advice_given"),
        ("Rejected advice (do not repeat)", "rejected_advice"),
        ("User corrections", "user_corrections"),
        ("Unresolved questions", "unresolved_questions"),
    ):
        items = st.get(key) or []
        if items:
            lines.append(f"{label}: " + "; ".join(items))
    return "\n".join(lines)


def _guess_topic(message: str) -> Optional[str]:
    m = _TOPIC_HINT_RE.search(message or "")
    if not m:
        return None
    return _clip(m.group(0), 40)


def _guess_emotion(message: str) -> Optional[str]:
    low = (message or "").lower()
    pairs = (
        (("κουρασ", "εξαντλη", "tired", "exhausted"), "tired"),
        (("αγχ", "άγχ", "stress", "worried", "φοβ"), "worried"),
        (("λυπ", "στεναχωρ", "sad", "upset"), "sad"),
        (("θυμ", "νεύρ", "frustrated", "angry"), "frustrated"),
        (("χαίρ", "χαρουμ", "glad", "happy"), "relieved"),
    )
    for needles, label in pairs:
        if any(n in low for n in needles):
            return label
    return None


def update_conversation_state(
    previous: Any,
    *,
    user_message: str,
    assistant_reply: str = "",
) -> dict[str, Any]:
    """Merge previous state with signals from the latest user turn (+ optional reply)."""
    st = normalize_conversation_state(previous)
    msg = (user_message or "").strip()
    if not msg:
        return st

    topic = _guess_topic(msg)
    if topic:
        st["current_topic"] = topic
    if len(msg) >= 12 and not _CORRECTION_RE.search(msg):
        st["current_concern"] = _clip(msg, _MAX_TOPIC_CHARS)

    emotion = _guess_emotion(msg)
    if emotion:
        st["emotional_context"] = emotion

    if _CORRECTION_RE.search(msg):
        st["user_corrections"] = _uniq_list(
            (st.get("user_corrections") or []) + [_clip(msg, 100)]
        )
        # Clear stale advice path after an explicit repair signal
        st["unresolved_questions"] = _uniq_list(
            (st.get("unresolved_questions") or [])
            + ["User indicated misunderstanding — clarify before advising"]
        )

    if _REJECTION_RE.search(msg):
        # Prefer rejecting the last advice_given item if present
        given = st.get("advice_given") or []
        rejected_item = given[-1] if given else _clip(msg, 100)
        st["rejected_advice"] = _uniq_list(
            (st.get("rejected_advice") or []) + [rejected_item]
        )

    # Age / concrete fact snippets
    age_m = re.search(
        r"(\d+)\s*(χρον|ετ|μην|month|year|yo|years?\s*old)",
        msg,
        re.I | re.U,
    )
    if age_m:
        st["important_facts"] = _uniq_list(
            (st.get("important_facts") or []) + [_clip(age_m.group(0), 40)]
        )

    reply = (assistant_reply or "").strip()
    if reply and ("?" in reply or "；" in reply or "؛" in reply):
        # Keep last clarifying question lightly
        q = reply.rsplit("?", 1)[0]
        tail = _clip(q.split(".")[-1] + "?", 100)
        if len(tail) > 8:
            st["unresolved_questions"] = _uniq_list(
                (st.get("unresolved_questions") or []) + [tail]
            )

    # Track a short advice fingerprint from assistant (first ~100 chars of a practical reply)
    if reply and len(reply) > 40 and not _CORRECTION_RE.search(msg):
        st["advice_given"] = _uniq_list(
            (st.get("advice_given") or []) + [_clip(reply, 100)]
        )

    return normalize_conversation_state(st)
