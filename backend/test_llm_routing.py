import unittest

from llm_routing import (
    DEFAULT_LLM_ROUTING,
    is_complex_message,
    normalize_llm_routing,
    resolve_provider_order,
)


class NormalizeTests(unittest.TestCase):
    def test_defaults(self):
        out = normalize_llm_routing(None)
        self.assertEqual(out["default_order"], DEFAULT_LLM_ROUTING["default_order"])

    def test_dedupe_and_fill(self):
        out = normalize_llm_routing({"default_order": ["gemini", "gemini", "nope"]})
        self.assertEqual(out["default_order"][0], "gemini")
        self.assertIn("grok", out["default_order"])
        self.assertIn("claude", out["default_order"])


class ResolveTests(unittest.TestCase):
    def test_image(self):
        self.assertEqual(
            resolve_provider_order(has_image=True, msg_lang="en", complex_query=False)[0],
            "gemini",
        )

    def test_gemini_lang(self):
        self.assertEqual(
            resolve_provider_order(has_image=False, msg_lang="ar", complex_query=False)[0],
            "gemini",
        )

    def test_default(self):
        self.assertEqual(
            resolve_provider_order(has_image=False, msg_lang="el", complex_query=False)[0],
            "grok",
        )


class ComplexTests(unittest.TestCase):
    def test_keyword(self):
        self.assertTrue(is_complex_message("I have a fever tonight"))

    def test_length(self):
        self.assertTrue(is_complex_message("x" * 301))
        self.assertFalse(is_complex_message("hello"))


if __name__ == "__main__":
    unittest.main()
