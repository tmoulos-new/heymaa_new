"""Shared helpers for validating and shaping chat model replies."""
from __future__ import annotations


def looks_truncated_reply(text: str) -> bool:
    """Detect replies that end mid-word or mid-sentence."""
    t = (text or "").strip()
    if not t:
        return True
    last = t[-1]
    # Greek questions often end with ; — treat as a complete sentence.
    if last in ".!?;…»\"')":
        return False
    if last in ",:(-–—":
        return True
    if last.isalpha() or last.isdigit():
        return True
    return False
