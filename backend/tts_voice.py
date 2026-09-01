"""TTS voice + delivery for chat Listen. Greek uses native Athina, slower and warmer."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time

VOICE_MAP = {
    "el": "el-GR-AthinaNeural",
    "en": "en-US-JennyNeural",
    "ar": "ar-EG-SalmaNeural",
    "ur": "ur-PK-UzmaNeural",
    "hi": "hi-IN-SwaraNeural",
    "es": "es-ES-ElviraNeural",
    "pt": "pt-BR-FranciscaNeural",
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "it": "it-IT-ElsaNeural",
    "ru": "ru-RU-SvetlanaNeural",
    "tr": "tr-TR-EmelNeural",
    "id": "id-ID-GadisNeural",
    "bn": "bn-BD-NabanitaNeural",
    "sw": "sw-KE-ZuriNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "ja": "ja-JP-NanamiNeural",
    "nl": "nl-NL-ColetteNeural",
    "pl": "pl-PL-ZofiaNeural",
    "ro": "ro-RO-AlinaNeural",
    "bg": "bg-BG-KalinaNeural",
    "sr": "sr-RS-SophieNeural",
    "mr": "mr-IN-AarohiNeural",
    "te": "te-IN-ShrutiNeural",
}

# AthinaNeural is native Greek; default speed (~156 wpm) sounds rushed for a companion.
_PROSODY = {
    "el": {"rate": "-20%", "pitch": "+6Hz", "volume": "+0%"},
    "default": {"rate": "-10%", "pitch": "+3Hz", "volume": "+0%"},
}

_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002700-\U000027BF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002600-\U000026FF"
    "\U0000FE0F"
    "\U0000200D"
    "]+",
    flags=re.UNICODE,
)


def tts_voice(lang: str) -> str:
    return VOICE_MAP.get((lang or "el").strip().lower()[:2], VOICE_MAP["en"])


def tts_prosody(lang: str) -> dict[str, str]:
    key = (lang or "el").strip().lower()[:2]
    return dict(_PROSODY.get(key, _PROSODY["default"]))


def prepare_tts_text(text: str, lang: str = "el") -> str:
    """Strip markup/emoji so Athina stays in Greek instead of naming symbols in English."""
    t = (text or "").strip()
    t = re.sub(r"\*\*(.+?)\*\*", r"\1", t)
    t = re.sub(r"\*(.+?)\*", r"\1", t)
    t = re.sub(r"`(.+?)`", r"\1", t)
    t = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", t)
    t = _EMOJI_RE.sub(" ", t)
    if (lang or "").startswith("el"):
        t = t.replace("&", " και ")
        # Brand is spelled HeyMaa; Athina should say χέιμα (Hey-ma).
        t = re.sub(r"(?i)\bheymaa\b", "χέιμα", t)
    t = re.sub(r"!{2,}", ".", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def split_tts_utterances(text: str, first_chars: int = 180) -> list[str]:
    """First clip is short enough to start Listen quickly; the rest follows in a second clip."""
    t = (text or "").strip()
    if not t:
        return []
    if len(t) <= first_chars:
        return [t]
    cut = None
    for match in re.finditer(r"[\.!?…;:](?:\s+|$)", t):
        cut = match.end()
        if match.end() >= first_chars:
            break
    if cut is None or cut < 40:
        sp = t.rfind(" ", 0, min(len(t), first_chars + 40))
        cut = sp if sp >= 40 else first_chars
    first, rest = t[:cut].strip(), t[cut:].strip()
    if not rest:
        return [first]
    return [first, rest]


def encode_tts_resume(secret: bytes, user_key: str, lang: str, text: str, ttl_s: int = 180) -> str:
    payload = {"u": user_key, "l": lang, "e": int(time.time()) + ttl_s, "t": text}
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(secret, raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig + raw).decode("ascii")


def decode_tts_resume(secret: bytes, token: str, user_key: str) -> tuple[str, str]:
    try:
        blob = base64.urlsafe_b64decode((token or "").encode("ascii"))
    except Exception as exc:
        raise ValueError("invalid resume") from exc
    if len(blob) < 33:
        raise ValueError("invalid resume")
    sig, raw = blob[:32], blob[32:]
    expected = hmac.new(secret, raw, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("invalid resume")
    data = json.loads(raw.decode("utf-8"))
    if data.get("u") != user_key:
        raise ValueError("invalid resume")
    if int(data.get("e") or 0) < time.time():
        raise ValueError("expired resume")
    text = (data.get("t") or "").strip()
    lang = str(data.get("l") or "el")
    if not text:
        raise ValueError("empty resume")
    return lang, text
