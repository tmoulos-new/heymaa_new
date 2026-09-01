"""TTS voice + delivery for chat Listen. Greek uses native Athina, slower and warmer."""

from __future__ import annotations

import re

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
    t = re.sub(r"!{2,}", ".", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t
