import unittest

from main import _is_usable_reply
from replicate_chat import looks_truncated_reply


class LlmReplyQualityTests(unittest.TestCase):
    def test_accepts_normal_greeting(self):
        self.assertTrue(_is_usable_reply("Καλημέρα! Πώς μπορεί να βοηθήσει σήμερα;"))

    def test_rejects_instruction_leak_bullets(self):
        self.assertFalse(_is_usable_reply("* used? Yes. * Tone: Warm, professional? Yes."))

    def test_rejects_short_empty(self):
        self.assertFalse(_is_usable_reply("ok"))

    def test_rejects_truncated_mid_sentence(self):
        self.assertTrue(looks_truncated_reply("Γιώργο, τώρα που μόλις γέννησες, είναι"))
        self.assertFalse(_is_usable_reply("Γιώργο, τώρα που μόλις γέννησες, είναι"))

    def test_rejects_truncated_trailing_comma(self):
        self.assertTrue(looks_truncated_reply("Είμαι έτοιμη να σε βοηθήσω με ό,"))
        self.assertFalse(_is_usable_reply("Είμαι έτοιμη να σε βοηθήσω με ό,"))

    def test_accepts_complete_sentences(self):
        self.assertFalse(looks_truncated_reply("Είμαι εδώ για να σε βοηθήσω. Πες μου τι χρειάζεσαι."))


if __name__ == "__main__":
    unittest.main()
