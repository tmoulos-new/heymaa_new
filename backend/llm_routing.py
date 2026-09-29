"""Admin-editable LLM failover routing (Grok / Gemini / Claude).

Stored as JSON in chat_prompt_settings under key ``llm_routing``.
"""
from __future__ import annotations

import json
import re
import unicodedata
from copy import deepcopy
from typing import Any, Optional

ALLOWED_PROVIDERS = ("grok", "gemini", "claude")

DEFAULT_LLM_ROUTING: dict[str, Any] = {
    "default_order": ["grok", "gemini", "claude"],
    "image_order": ["gemini", "claude", "grok"],
    "gemini_first_langs": ["ar", "zh", "ja", "hi", "ur", "bn", "mr", "te", "fil", "sw"],
    "gemini_first_order": ["gemini", "grok", "claude"],
    "complex_order": ["grok", "gemini", "claude"],
    "complex_keywords": [
        "diagnosis",
        "symptoms",
        "emergency",
        "medication",
        "fever",
        "hospital",
        "allergy",
        "depression",
        "anxiety",
    ],
    "complex_min_chars": 300,
    # Nearby / places questions → Gemini first (Maps grounding on Gemini path).
    "places_order": ["gemini", "grok", "claude"],
    "places_keywords": [
        "near me",
        "nearby",
        "near by",
        "close to me",
        "around here",
        "in my area",
        "find me a",
        "find a pediatrician",
        "find a doctor",
        "find a pharmacy",
        "find a midwife",
        "find doctors",
        "find pediatricians",
        "list of doctors",
        "list of pediatricians",
        "list of pharmacies",
        "doctors near",
        "doctors in ",
        "pediatricians near",
        "pediatricians in ",
        "pharmacies near",
        "pharmacies in ",
        "pediatrician near",
        "pharmacy near",
        "doctor near",
        "doctors list",
        "clinic near",
        "hospital near",
        "playground near",
        "park near",
        "nearest",
        "recommend a doctor",
        "recommend a pediatrician",
        "suggest a doctor",
        "suggest a pediatrician",
        "where can i find a doctor",
        "where can i find a pediatrician",
        "where can i find a pharmacy",
        "κοντά μου",
        "κοντά στην",
        "κοντά στο",
        "κοντά μας",
        "βρες μου",
        "βρες έναν",
        "βρες μία",
        "βρες μια",
        "βρες γιατρό",
        "βρες γιατρο",
        "βρες παιδίατρο",
        "βρες παιδιατρο",
        "βρες φαρμακείο",
        "βρες φαρμακειο",
        "λίστα γιατρών",
        "λιστα γιατρων",
        "λίστα παιδιάτρων",
        "λιστα παιδιατρων",
        "λίστα φαρμακείων",
        "γιατρούς κοντά",
        "γιατρους κοντα",
        "γιατρούς στην",
        "γιατρους στην",
        "παιδιάτρους κοντά",
        "παιδιατρους κοντα",
        "παιδίατρο κοντά",
        "παιδιατρο κοντα",
        "φαρμακείο κοντά",
        "φαρμακειο κοντα",
        "φαρμακεία κοντά",
        "παιδική χαρά",
        "παιδικη χαρα",
        "πάρκο κοντά",
        "παρκο κοντα",
        "μαία κοντά",
        "μαια κοντα",
        "κλινική κοντά",
        "νοσοκομείο κοντά",
        "πού να βρω γιατρό",
        "που να βρω γιατρο",
        "πού να βρω παιδίατρο",
        "που να βρω παιδιατρο",
        "πού να βρω φαρμακείο",
        "που να βρω φαρμακειο",
        "πρότεινέ μου γιατρό",
        "προτεινε μου γιατρο",
        "πρότεινέ μου παιδίατρο",
        # Natural Greek word-order variants («να μου βρεις … στη …»)
        "να μου βρεις",
        "μου βρεις",
        "μου βρες",
        "βρεις ",
        "παιδιατρους στη",
        "παιδιάτρους στη",
        "παιδιατρους στην",
        "παιδιάτρους στην",
        "γιατρους στη",
        "γιατρούς στη",
        "φαρμακεια στη",
        "φαρμακεία στη",
        # Party / venue / place-list asks (Greek + English)
        "πάρτυ",
        "παρτυ",
        "party",
        "παιδότοπ",
        "παιδοτοπ",
        "παιδοτοπος",
        "παιδότοπος",
        "μέρη για",
        "μερη για",
        "ορισμένα μέρη",
        "ορισμενα μερη",
        "χώροι πάρτυ",
        "χωροι παρτυ",
        "χώρο για πάρτυ",
        "χωρο για παρτυ",
        "δώσε μου μέρη",
        "δωσε μου μερη",
        "πεσ μου μέρη",
        "πεσ μου μερη",
        "πεσ μου ορισμένα μέρη",
        "πεσ μου ορισμενα μερη",
        "πες μου μέρη",
        "πες μου μερη",
        "πες μου ορισμένα μέρη",
        "πες μου ορισμενα μερη",
        "venues for",
        "party venue",
        "party place",
        "birthday party",
        "kids party",
        "children's party",
        "childrens party",
        "indoor playground",
        "play cafe",
        "playcafé",
    ],
}

LLM_ROUTING_KEY = "llm_routing"


def _clean_order(raw: Any, fallback: list[str]) -> list[str]:
    out: list[str] = []
    if isinstance(raw, list):
        for item in raw:
            name = str(item or "").strip().lower()
            if name in ALLOWED_PROVIDERS and name not in out:
                out.append(name)
    if not out:
        out = list(fallback)
    # Ensure every allowed provider appears exactly once (append missing).
    for name in ALLOWED_PROVIDERS:
        if name not in out:
            out.append(name)
    return out


def _clean_langs(raw: Any, fallback: list[str]) -> list[str]:
    out: list[str] = []
    src = raw if isinstance(raw, list) else fallback
    for item in src:
        code = str(item or "").strip().lower()
        if code and code not in out:
            out.append(code)
    return out


def _clean_keywords(raw: Any, fallback: list[str]) -> list[str]:
    out: list[str] = []
    src = raw if isinstance(raw, list) else fallback
    for item in src:
        kw = str(item or "").strip().lower()
        if kw and kw not in out:
            out.append(kw)
    return out


def normalize_llm_routing(raw: Any) -> dict[str, Any]:
    base = deepcopy(DEFAULT_LLM_ROUTING)
    if not isinstance(raw, dict):
        return base
    base["default_order"] = _clean_order(raw.get("default_order"), base["default_order"])
    base["image_order"] = _clean_order(raw.get("image_order"), base["image_order"])
    base["gemini_first_order"] = _clean_order(
        raw.get("gemini_first_order"), base["gemini_first_order"]
    )
    base["complex_order"] = _clean_order(raw.get("complex_order"), base["complex_order"])
    base["places_order"] = _clean_order(raw.get("places_order"), base["places_order"])
    base["gemini_first_langs"] = _clean_langs(
        raw.get("gemini_first_langs"), base["gemini_first_langs"]
    )
    base["complex_keywords"] = _clean_keywords(
        raw.get("complex_keywords"), base["complex_keywords"]
    )
    base["places_keywords"] = _clean_keywords(
        raw.get("places_keywords"), base["places_keywords"]
    )
    # Always keep built-in place triggers; admin may add extras on top.
    if isinstance(raw, dict) and "places_keywords" in raw:
        extras = _clean_keywords(raw.get("places_keywords"), [])
        merged: list[str] = []
        for kw in list(DEFAULT_LLM_ROUTING["places_keywords"]) + extras:
            if kw not in merged:
                merged.append(kw)
        base["places_keywords"] = merged
    try:
        n = int(raw.get("complex_min_chars", base["complex_min_chars"]))
        base["complex_min_chars"] = max(50, min(n, 5000))
    except (TypeError, ValueError):
        pass
    return base


def parse_routing_json(text: str) -> dict[str, Any]:
    try:
        return normalize_llm_routing(json.loads(text or "{}"))
    except Exception:
        return deepcopy(DEFAULT_LLM_ROUTING)


def is_complex_message(message: str, routing: Optional[dict[str, Any]] = None) -> bool:
    cfg = normalize_llm_routing(routing) if routing is not None else deepcopy(DEFAULT_LLM_ROUTING)
    text = (message or "").lower()
    keywords = cfg.get("complex_keywords") or []
    if any(kw in text for kw in keywords):
        return True
    try:
        min_chars = int(cfg.get("complex_min_chars") or 300)
    except (TypeError, ValueError):
        min_chars = 300
    return len(message or "") > min_chars


def _fold_places_text(message: str) -> str:
    """Lowercase + strip combining accents so στη/στήν and παιδίατρο/παιδιατρο match."""
    text = (message or "").lower().replace("ς", "σ")
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")


# Find-local intent: (find verb) + (place type) + (location cue), accent-insensitive.
_PLACES_FIND_RE = re.compile(
    r"(βρ(?:εσ|εισ|ω|ειτε)|ψαξ(?:ε|ω|τε)|find(?:\s+me)?|looking\s+for|recommend|suggest|"
    r"λιστα|list\s+of|που\s+να\s+βρω|where\s+can\s+i\s+find|"
    r"πεσ\s+μου|πες\s+μου|δωσε\s+μου|προτεινε|"
    r"ορισμεν[αη]\s+μερη|μερη\s+για)",
    re.I,
)
_PLACES_TYPE_RE = re.compile(
    r"(παιδιατρ|γιατρ|φαρμακει|μαια|μαιευ|κλινικ|νοσοκομει|"
    r"παιδικη\s+χαρα|παρκο|παιδοτοπ|παρτυ|χωρ(?:οσ|οι|ουσ)?\s+για\s+παρτυ|"
    r"pediatrician|doctor|pharmacy|midwife|clinic|hospital|playground|park|"
    r"party\s+(?:venue|place|room)|birthday\s+party|kids?\s+party|indoor\s+playground)",
    re.I,
)
_PLACES_LOC_RE = re.compile(
    r"(κοντα|στην|στη|στον|στο|σε\s+περιοχη|near|nearby|around|in\s+my\s+area|\bin\s+[a-zα-ω]{3,})",
    re.I,
)


def is_places_message(message: str, routing: Optional[dict[str, Any]] = None) -> bool:
    """Detect nearby / local-places intent (EN + EL keywords + structural patterns)."""
    cfg = normalize_llm_routing(routing) if routing is not None else deepcopy(DEFAULT_LLM_ROUTING)
    raw = (message or "").strip()
    if not raw:
        return False
    folded = _fold_places_text(raw)
    keywords = cfg.get("places_keywords") or []
    for kw in keywords:
        if _fold_places_text(str(kw)) and _fold_places_text(str(kw)) in folded:
            return True
    # «μπορείς να μου βρεις παιδιάτρους στη Ηλιούπολη» etc.
    if _PLACES_FIND_RE.search(folded) and _PLACES_TYPE_RE.search(folded) and _PLACES_LOC_RE.search(folded):
        return True
    return False


def resolve_provider_order(
    *,
    has_image: bool,
    msg_lang: str,
    complex_query: bool,
    places_query: bool = False,
    routing: Optional[dict[str, Any]] = None,
) -> list[str]:
    cfg = normalize_llm_routing(routing) if routing is not None else deepcopy(DEFAULT_LLM_ROUTING)
    lang = (msg_lang or "").strip().lower()
    gemini_langs = {str(x).lower() for x in (cfg.get("gemini_first_langs") or [])}
    if has_image:
        return list(cfg["image_order"])
    # Places before complex: "hospital near me" is local search, not medical advice dump.
    if places_query:
        return list(cfg["places_order"])
    if lang in gemini_langs:
        return list(cfg["gemini_first_order"])
    if complex_query:
        return list(cfg["complex_order"])
    return list(cfg["default_order"])
