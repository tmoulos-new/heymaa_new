"""Detect capturable family moments in chat user messages."""

from __future__ import annotations

import re
from datetime import date
from typing import Any, Optional
import unicodedata


def _fold(s: str) -> str:
    """Lowercase + strip accents for fuzzy Greek/ Latin matching."""
    s = (s or "").lower()
    nfkd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")

# Questions / help requests — not journal moments
_SKIP = re.compile(
    r"(?i)^(\s*(τι|what|how|why|when|where|ποιος|ποια|ποιο|πώς|γιατί|πότε|που)\b|"
    r".*\?(.*\?)?$|"
    r"(should i|τι να κάνω|help me|βοήθ|μπορείς|can you|tell me|πες μου|explain))",
)

# Strong milestone / first-time signals
_MILESTONE = re.compile(
    r"(?i)(πρώτ|πρωτ|1ο\s|1η\s|first\s+(time|steps?|word|tooth|smile|bath|haircut)|"
    r"πρώτα\s+(βήματα|δοντάκ|χαμόγελ|λέξη|μπιμπίκο|κούρεμα)|"
    r"πρωτα\s+(βηματα|δοντακ|χαμογελ|λεξη|μπικινι|κουρεμα))",
)

# Today/yesterday + achievement verb
_MOMENT = re.compile(
    r"(?i)(σήμερα|σημερα|χθες|εχθές|εχες|today|yesterday).{0,50}"
    r"(έκανε|εκανε|έκαν|εκαν|περπάτη|περπατη|walk|smil|κοιμ|slept|είπε|ειπε|said|έφαγε|εφαγε|ate|έπεσε|επεσε|fell|μπήκε|μπηκε|climb)",
)

# Proud / emotional sharing (softer signal — needs min length)
_EMOTIONAL = re.compile(r"(?i)(🎉|💛|❤️|τόσο\s+όμορφ|so\s+(cute|proud|happy)|μπράβο|proud)")

_EMOJI_MAP = (
    (re.compile(r"(?i)(δοντ|tooth|teeth)"), "🦷"),
    (re.compile(r"(?i)(χαμογ|smil)"), "😊"),
    (re.compile(r"(?i)(βήμα|walk|step|περπα)"), "🚶"),
    (re.compile(r"(?i)(μπάνι|bath)"), "🛁"),
    (re.compile(r"(?i)(κοιμ|sleep)"), "😴"),
    (re.compile(r"(?i)(μίλ|word|speak|said|είπε|babbl)"), "👶"),
)


def _emoji_for(text: str) -> str:
    for pat, em in _EMOJI_MAP:
        if pat.search(text):
            return em
    return "💛"


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _is_duplicate(text: str, recent: Optional[list[Any]]) -> bool:
    norm = _normalize(text)[:100]
    if not norm:
        return True
    for m in recent or []:
        existing = _normalize(getattr(m, "text", None) or (m.get("text") if isinstance(m, dict) else ""))
        if not existing:
            continue
        if norm in existing or existing in norm:
            return True
        # word overlap
        a = set(norm.split())
        b = set(existing.split())
        if len(a & b) >= max(3, min(len(a), len(b)) // 2):
            return True
    return False


def _extract_title(message: str, lang: str) -> str:
    text = message.strip()
    # First sentence / clause
    parts = re.split(r"[.!?\n]+", text, maxsplit=1)
    title = (parts[0] or text).strip()
    # Trim filler openers
    title = re.sub(
        r"(?i)^(σήμερα|χθες|εχθές|today|yesterday|το\s+μωρό|το\s+παιδί|my\s+baby|the\s+baby)\s*[,:-]?\s*",
        "",
        title,
    ).strip()
    if len(title) > 88:
        title = title[:85].rstrip() + "…"
    if len(title) < 8:
        title = text[:88].rstrip()
    # Capitalize first letter for display
    if title and lang == "el":
        return title[0].upper() + title[1:] if len(title) > 1 else title.upper()
    return title[:1].upper() + title[1:] if title else text[:88]


def _infer_ref(message: str, profile: Any) -> Optional[str]:
    if not profile:
        return None
    children = getattr(profile, "children", None) or []
    msg_lower = message.lower()
    for ch in children:
        name = getattr(ch, "name", None) or (ch.get("name") if isinstance(ch, dict) else None)
        if name and name.lower() in msg_lower:
            return name
    if getattr(profile, "dueDate", None) and re.search(
        r"(?i)(εγκυμοσύν|pregnanc|έμβρυ|κοιλ|bump|ultrasound|υπέρηχ)", message
    ):
        return "pregnancy"
    if children:
        first = children[0]
        return getattr(first, "name", None) or (first.get("name") if isinstance(first, dict) else None)
    child_name = getattr(profile, "childName", None)
    return child_name or None


def detect_memory_suggestion(
    message: str,
    profile: Any = None,
    recent_memories: Optional[list[Any]] = None,
    lang: str = "el",
) -> Optional[dict[str, Any]]:
    """
    Return structured suggestion or None.
    Analyses the USER message (not the assistant reply).
    """
    text = (message or "").strip()
    if len(text) < 14 or len(text) > 600:
        return None
    folded = _fold(text)
    if _SKIP.search(text) or _SKIP.search(folded):
        return None

    kind = None
    if _MILESTONE.search(text) or _MILESTONE.search(folded):
        kind = "milestone"
    elif _MOMENT.search(text) or _MOMENT.search(folded):
        kind = "moment"
    elif len(text) >= 28 and (_EMOTIONAL.search(text) or _EMOTIONAL.search(folded)):
        kind = "moment"

    if not kind:
        return None

    title = _extract_title(text, lang or "el")
    if _is_duplicate(title, recent_memories) or _is_duplicate(text, recent_memories):
        return None

    ref = _infer_ref(text, profile)
    description = text if _normalize(text) != _normalize(title) else None

    return {
        "text": title,
        "emoji": _emoji_for(text),
        "description": (description[:240] if description else None),
        "ref": ref,
        "kind": kind,
        "date_iso": date.today().isoformat(),
    }
