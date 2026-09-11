"""
RAG need evaluator — decide whether a chat message should retrieve knowledge chunks.

Kept as a separate tool so chat can skip embed + match_chunks when RAG won't help
(greetings, thanks, chitchat, meta questions about the app, pure empathy, etc.).
"""

from __future__ import annotations

import re
import time
from typing import Any, Optional

# Fast path: clearly no knowledge retrieval needed
_SKIP_PATTERNS = [
    r"^\s*(hi|hello|hey|γεια|γειά|καλημέρα|καλησπέρα|καλημερα|καλησπερα|χαίρετε)\b",
    r"^\s*(thanks|thank you|ευχαριστώ|ευχαριστω|merci|gracias)\b",
    r"^\s*(ok|okay|ωραία|ωραια|εντάξει|ενταξει|ναι|όχι|οχι|yes|no|yep|nope)\s*[!.]*\s*$",
    r"^\s*(bye|goodbye|αντίο|αντιο|τα λέμε|τα λεμε)\b",
    r"^\s*(lol|haha|χαχα)\s*$",
]

# Strong signals that parenthood / medical / developmental knowledge helps
_NEED_PATTERNS = [
    # pregnancy / trimesters / labour
    r"\b(pregnan|trimester|gestation|ultrasound|contraction|labour|labor|epidural|"
    r"έγκυ|εγκυμοσ|τρίμηνο|τριμηνο|τοκετ|υπερηχ|ναυτί|ναυτι)\w*",
    # baby / child development / sleep / feeding
    r"\b(newborn|infant|toddler|breastfeed|formula|weaning|colic|teething|"
    r"milestone|vaccin|vaccine|fever|rash|diaper|nappy|crib|swaddle|"
    r"μωρό|μωρο|βρέφος|βρεφος|παιδί|παιδι|θηλασμ|γάλα|γαλα|ύπνο|υπνο|"
    r"οδοντοφυ|εμβόλι|εμβολι|πυρετ|εξάνθη|εξανθη|πάνα|πανα)\w*",
    # parenting advice / what should I do
    r"\b(how (do|can|should) (i|we|my)|what (should|can|do) (i|we)|"
    r"when (should|can|do) (i|we)|"
    r"is it (normal|safe)|why (is|does|do)|"
    r"πώς|πως|τι (να|κάνω|κανω)|πότε|ποτε|είναι (φυσιολογ|ασφαλ)|"
    r"γιατί|γιατι)\b",
    # nutrition / health
    r"\b(nutrition|allergy|allerg|symptom|doctor|pediatric|"
    r"διατροφ|αλλεργ|σύμπτωμ|συμπτωμ|παιδίατρ|παιδιατρ|γιατρ)\w*",
]

# Soft chitchat / meta about the product — usually no RAG
_SOFT_SKIP_PATTERNS = [
    r"\b(who are you|what (can|do) you do|your name|"
    r"ποια είσαι|ποια εισαι|τι κάνεις|τι κανεις|πώς σε λένε|πως σε λενε)\b",
    r"\b(i('m| am) (just )?(sad|happy|tired|lonely|scared)|"
    r"νιώθω|νιωθω|είμαι (κουρασ|στεναχωρη|στενοχωρη|χαρούμεν))\w*",
]

_SKIP_RE = [re.compile(p, re.I | re.U) for p in _SKIP_PATTERNS]
_NEED_RE = [re.compile(p, re.I | re.U) for p in _NEED_PATTERNS]
_SOFT_SKIP_RE = [re.compile(p, re.I | re.U) for p in _SOFT_SKIP_PATTERNS]


def _word_count(text: str) -> int:
    return len(re.findall(r"\w+", text or "", flags=re.U))


def evaluate_rag_need(
    message: str,
    *,
    has_attachments: bool = False,
    profile_lang: Optional[str] = None,
) -> dict[str, Any]:
    """
    Return whether RAG retrieval should run for this user message.

    Result shape:
      {
        "needs_rag": bool,
        "confidence": float 0..1,
        "reason": str,          # machine code
        "reason_label": str,    # short human label
        "signals": list[str],
        "elapsed_ms": float,
      }
    """
    t0 = time.perf_counter()
    text = (message or "").strip()
    signals: list[str] = []
    if profile_lang:
        signals.append(f"lang={str(profile_lang).strip().lower()}")

    if has_attachments:
        signals.append("has_attachments")
        # Images/files: still allow RAG for text questions about them, but
        # pure image with no text usually doesn't need knowledge chunks.
        if not text or len(text) < 8:
            return _result(
                False,
                0.7,
                "attachment_only",
                "Attachment only — skip RAG",
                signals,
                t0,
            )

    if not text:
        return _result(False, 0.95, "empty", "Empty message — skip RAG", signals, t0)

    wc = _word_count(text)
    signals.append(f"words={wc}")

    for rx in _SKIP_RE:
        if rx.search(text):
            signals.append(f"skip_pattern={rx.pattern[:48]}")
            # Very short greetings/thanks → skip; if long message also matches need, continue
            if wc <= 12:
                return _result(
                    False,
                    0.9,
                    "chitchat",
                    "Greeting / thanks / short ack — skip RAG",
                    signals,
                    t0,
                )

    need_hits = 0
    for rx in _NEED_RE:
        if rx.search(text):
            need_hits += 1
            signals.append(f"need_pattern={rx.pattern[:48]}")

    if need_hits >= 1:
        conf = min(0.95, 0.55 + 0.15 * need_hits)
        return _result(
            True,
            conf,
            "knowledge_intent",
            "Parenting / health / how-to intent — use RAG",
            signals,
            t0,
        )

    for rx in _SOFT_SKIP_RE:
        if rx.search(text):
            signals.append(f"soft_skip={rx.pattern[:48]}")
            return _result(
                False,
                0.75,
                "meta_or_emotion",
                "Meta / emotional support — skip RAG",
                signals,
                t0,
            )

    # Question mark or Greek/English interrogatives without domain keywords:
    # short → skip; longer open questions → retrieve (benefit of the doubt)
    is_question = "?" in text or bool(
        re.search(r"^\s*(τι|πως|πώς|ποιος|ποια|γιατί|γιατι|when|what|how|why|who|where)\b", text, re.I)
    )
    if is_question:
        signals.append("is_question")
        if wc >= 8:
            return _result(
                True,
                0.55,
                "open_question",
                "Open question — use RAG",
                signals,
                t0,
            )
        return _result(
            False,
            0.6,
            "short_question",
            "Short non-domain question — skip RAG",
            signals,
            t0,
        )

    # Default: short chat → skip; longer statements → retrieve lightly
    if wc <= 6:
        return _result(
            False,
            0.65,
            "short_utterance",
            "Short utterance — skip RAG",
            signals,
            t0,
        )

    return _result(
        True,
        0.5,
        "default_retrieve",
        "Longer message — use RAG",
        signals,
        t0,
    )


def _result(
    needs_rag: bool,
    confidence: float,
    reason: str,
    reason_label: str,
    signals: list[str],
    t0: float,
) -> dict[str, Any]:
    return {
        "needs_rag": bool(needs_rag),
        "confidence": round(float(confidence), 3),
        "reason": reason,
        "reason_label": reason_label,
        "signals": list(signals),
        "elapsed_ms": round((time.perf_counter() - t0) * 1000, 2),
        "tool": "evaluator",
    }


# Alias for callers that prefer a shorter name
evaluate = evaluate_rag_need
