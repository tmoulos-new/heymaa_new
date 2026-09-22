import unittest

from llm_reply import looks_truncated_reply


class TestLooksTruncatedReply(unittest.TestCase):
    def test_complete_sentence(self):
        self.assertFalse(looks_truncated_reply("Hello there."))
        self.assertFalse(looks_truncated_reply("Τι κάνεις;"))

    def test_mid_word(self):
        self.assertTrue(looks_truncated_reply("Hello ther"))
        self.assertTrue(looks_truncated_reply("Hello,"))


if __name__ == "__main__":
    unittest.main()
