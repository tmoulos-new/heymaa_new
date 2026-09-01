"""Unit tests for tts_voice — run: python -m unittest backend.test_tts_voice"""
from __future__ import annotations

import unittest

from tts_voice import prepare_tts_text, tts_prosody, tts_voice


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
