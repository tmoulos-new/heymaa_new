"""Admin-editable LLM failover routing (Grok / Gemini / Claude).

Stored as JSON in chat_prompt_settings under key ``llm_routing``.
"""
from __future__ import annotations

import json
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
    base["gemini_first_langs"] = _clean_langs(
        raw.get("gemini_first_langs"), base["gemini_first_langs"]
    )
    base["complex_keywords"] = _clean_keywords(
        raw.get("complex_keywords"), base["complex_keywords"]
    )
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


def resolve_provider_order(
    *,
    has_image: bool,
    msg_lang: str,
    complex_query: bool,
    routing: Optional[dict[str, Any]] = None,
) -> list[str]:
    cfg = normalize_llm_routing(routing) if routing is not None else deepcopy(DEFAULT_LLM_ROUTING)
    lang = (msg_lang or "").strip().lower()
    gemini_langs = {str(x).lower() for x in (cfg.get("gemini_first_langs") or [])}
    if has_image:
        return list(cfg["image_order"])
    if lang in gemini_langs:
        return list(cfg["gemini_first_order"])
    if complex_query:
        return list(cfg["complex_order"])
    return list(cfg["default_order"])
