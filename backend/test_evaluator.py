"""Unit tests for the RAG need evaluator tool."""

import unittest

from evaluator import evaluate_rag_need


class EvaluatorTests(unittest.TestCase):
    def test_greeting_skips_rag(self):
        r = evaluate_rag_need("Γεια σου!")
        self.assertFalse(r["needs_rag"])
        self.assertEqual(r["reason"], "chitchat")
        self.assertEqual(r["tool"], "evaluator")

    def test_thanks_skips_rag(self):
        r = evaluate_rag_need("thanks a lot")
        self.assertFalse(r["needs_rag"])

    def test_pregnancy_needs_rag(self):
        r = evaluate_rag_need("Τι να περιμένω στο 6ο μήνα εγκυμοσύνης;")
        self.assertTrue(r["needs_rag"])
        self.assertEqual(r["reason"], "knowledge_intent")

    def test_sleep_advice_needs_rag(self):
        r = evaluate_rag_need("How can I help my baby sleep through the night?")
        self.assertTrue(r["needs_rag"])

    def test_meta_skips_rag(self):
        r = evaluate_rag_need("Who are you and what can you do?")
        self.assertFalse(r["needs_rag"])
        self.assertEqual(r["reason"], "meta_or_emotion")

    def test_attachment_only_skips(self):
        r = evaluate_rag_need("", has_attachments=True)
        self.assertFalse(r["needs_rag"])
        self.assertEqual(r["reason"], "attachment_only")

    def test_short_ok_skips(self):
        r = evaluate_rag_need("ok")
        self.assertFalse(r["needs_rag"])


if __name__ == "__main__":
    unittest.main()
