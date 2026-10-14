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

    def test_ti_kaneis_skips_rag(self):
        for msg in ("Τι κάνεις", "τι κάνεις;", "πώς είσαι", "Πώς είσαι;"):
            r = evaluate_rag_need(msg)
            self.assertFalse(r["needs_rag"], msg)
            self.assertIn(r["reason"], ("chitchat", "meta_or_emotion"), msg)

    def test_ti_kaneis_about_sleep_still_needs_rag(self):
        r = evaluate_rag_need("τι κάνεις για τον ύπνο του μωρού;")
        self.assertTrue(r["needs_rag"])
        self.assertEqual(r["reason"], "knowledge_intent")

    def test_pure_greeting_detects_how_are_you(self):
        from evaluator import is_pure_greeting
        self.assertTrue(is_pure_greeting("Τι κάνεις;"))
        self.assertTrue(is_pure_greeting("τι κάνεις?"))
        self.assertFalse(is_pure_greeting("τι κάνεις για τον ύπνο του μωρού;"))
        self.assertFalse(is_pure_greeting("πώς κοιμάται ο Πάνος;"))

    def test_attachment_only_skips(self):
        r = evaluate_rag_need("", has_attachments=True)
        self.assertFalse(r["needs_rag"])
        self.assertEqual(r["reason"], "attachment_only")

    def test_short_ok_skips(self):
        r = evaluate_rag_need("ok")
        self.assertFalse(r["needs_rag"])

    def test_short_followup_alone_skips_rag(self):
        # Alone these skip; chat core expands with prior topic.
        for msg in ("δωσε μου τα βασικά", "τι λέει το υπουργειο?", "περισσότερα"):
            r = evaluate_rag_need(msg)
            self.assertFalse(r["needs_rag"], msg)

    def test_short_contextual_followup_detects(self):
        from evaluator import is_short_contextual_followup

        self.assertTrue(is_short_contextual_followup("δωσε μου τα βασικά"))
        self.assertTrue(is_short_contextual_followup("τι λέει το υπουργειο?"))
        self.assertTrue(is_short_contextual_followup("περισσότερα"))
        self.assertFalse(is_short_contextual_followup("ok"))
        self.assertFalse(is_short_contextual_followup("Γεια σου"))
        self.assertFalse(
            is_short_contextual_followup(
                "μπορείς να μου πεις το πρόγραμμα έως 12 μηνών?"
            )
        )


if __name__ == "__main__":
    unittest.main()
