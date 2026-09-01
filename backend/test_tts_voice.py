"""Unit tests for tts_voice — run: python -m unittest backend.test_tts_voice"""
from __future__ import annotations

import unittest

from tts_voice import (
    decode_tts_resume,
    encode_tts_resume,
    prepare_tts_text,
    split_tts_utterances,
    tts_prosody,
    tts_voice,
)


class TtsVoiceTests(unittest.TestCase):
    def test_greek_uses_native_athina(self):
        self.assertEqual(tts_voice("el"), "el-GR-AthinaNeural")

    def test_greek_is_slower_and_slightly_higher(self):
        p = tts_prosody("el")
        self.assertEqual(p["rate"], "-20%")
        self.assertEqual(p["pitch"], "+6Hz")

    def test_strips_emoji_so_voice_stays_greek(self):
        out = prepare_tts_text("Γεια σου ❤️ μαμά!", "el")
        self.assertNotIn("❤️", out)
        self.assertIn("μαμά", out)

    def test_ampersand_spoken_in_greek(self):
        self.assertIn("και", prepare_tts_text("Αγωγές & Φάρμακα", "el"))

    def test_heymaa_spoken_as_cheima(self):
        self.assertEqual(prepare_tts_text("Καλώς ήρθες στη HeyMaa!", "el"), "Καλώς ήρθες στη χέιμα!")
        self.assertIn("HeyMaa", prepare_tts_text("Welcome to HeyMaa!", "en"))

    def test_split_keeps_short_text_whole(self):
        self.assertEqual(split_tts_utterances("Γεια σου μαμά."), ["Γεια σου μαμά."])

    def test_split_starts_with_first_sentences(self):
        text = (
            "Πρώτη φράση αρκετά μεγάλη για να πιάσει το όριο. "
            "Δεύτερη φράση που μένει για μετά. "
            "Και μια τρίτη για το υπόλοιπο κείμενο."
        )
        parts = split_tts_utterances(text, first_chars=40)
        self.assertEqual(len(parts), 2)
        self.assertTrue(parts[0].startswith("Πρώτη"))
        self.assertIn("Δεύτερη", parts[1])

    def test_resume_roundtrip(self):
        secret = b"test-secret"
        token = encode_tts_resume(secret, "user-1", "el", "υπόλοιπο κείμενο")
        lang, text = decode_tts_resume(secret, token, "user-1")
        self.assertEqual(lang, "el")
        self.assertEqual(text, "υπόλοιπο κείμενο")
        with self.assertRaises(ValueError):
            decode_tts_resume(secret, token, "other-user")
