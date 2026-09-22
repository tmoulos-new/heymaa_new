import unittest
from unittest.mock import MagicMock, patch

from llm_provider_balances import collect_provider_balances, probe_groq_limits, probe_claude_spend


class GroqLimitsTests(unittest.TestCase):
    @patch("llm_provider_balances.requests.get")
    def test_parses_rate_limit_headers(self, get):
        resp = MagicMock()
        resp.ok = True
        resp.status_code = 200
        resp.headers = {
            "x-ratelimit-remaining-requests": "100",
            "x-ratelimit-limit-requests": "200",
            "x-ratelimit-remaining-tokens": "9000",
            "x-ratelimit-limit-tokens": "10000",
        }
        resp.text = "{}"
        get.return_value = resp
        out = probe_groq_limits("gsk_test")
        self.assertTrue(out["ok"])
        self.assertEqual(out["remaining_requests"], 100)
        self.assertEqual(out["limit_requests"], 200)
        self.assertIn("100/200", out["summary"].replace(",", ""))


class ClaudeSpendTests(unittest.TestCase):
    def test_no_key(self):
        out = probe_claude_spend("")
        self.assertFalse(out["ok"])
        self.assertEqual(out["msg"], "no key")

    def test_chat_key_without_admin(self):
        out = probe_claude_spend("sk-ant-api03-xxxxx")
        self.assertTrue(out["ok"])
        self.assertIn("ANTHROPIC_ADMIN_API_KEY", out["summary"])


class CollectTests(unittest.TestCase):
    @patch("llm_provider_balances.probe_claude_spend", return_value={"ok": True, "provider": "claude"})
    @patch("llm_provider_balances.probe_gemini_headroom", return_value={"ok": True, "provider": "gemini"})
    @patch("llm_provider_balances.probe_groq_limits", return_value={"ok": True, "provider": "groq"})
    def test_collect(self, *_mocks):
        out = collect_provider_balances({"groq": "a", "gemini": "b", "claude": "c"})
        self.assertIn("providers", out)
        self.assertIn("disclaimer", out)


if __name__ == "__main__":
    unittest.main()
