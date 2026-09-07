import unittest

from main import _is_usable_reply


class LlmReplyQualityTests(unittest.TestCase):
    def test_accepts_normal_greeting(self):
        self.assertTrue(_is_usable_reply("Καλημέρα! Πώς μπορεί να βοηθήσει σήμερα;"))

    def test_rejects_instruction_leak_bullets(self):
        self.assertFalse(_is_usable_reply("* used? Yes. * Tone: Warm, professional? Yes."))

    def test_rejects_short_empty(self):
        self.assertFalse(_is_usable_reply("ok"))


if __name__ == "__main__":
    unittest.main()
