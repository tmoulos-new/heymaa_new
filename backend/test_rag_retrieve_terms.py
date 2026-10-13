"""Unit tests for RAG keyword/term helpers (no network)."""
from __future__ import annotations

import unittest

from rag_retrieve import (
    _title_query_variants,
    expand_anchors_for_match,
    query_terms,
    search_terms_for_query,
    topic_anchors_in_text,
)


class RagRetrieveTermsTest(unittest.TestCase):
    def test_stops_exei_keeps_pireto(self):
        terms = query_terms("Ο πάνος εχει πυρετο")
        self.assertIn("πυρετο", terms)
        self.assertIn("πάνος", terms)
        self.assertNotIn("εχει", terms)
        self.assertNotIn("έχει", terms)

    def test_accented_exei_also_stopped(self):
        terms = query_terms("Το μωρό έχει πυρετό")
        self.assertNotIn("έχει", terms)
        self.assertNotIn("εχει", terms)
        self.assertTrue(any("πυρετ" in t for t in terms))

    def test_fever_anchor_detected(self):
        self.assertEqual(topic_anchors_in_text("Ο πάνος εχει πυρετο"), ["πυρετ"])
        self.assertEqual(topic_anchors_in_text("baby has fever"), ["fever"])

    def test_search_terms_stay_small(self):
        terms = search_terms_for_query("Ο πάνος εχει πυρετο")
        self.assertLessEqual(len(terms), 5)
        self.assertTrue(any("πυρετ" in t for t in terms))

    def test_title_variants_strip_final_vowel(self):
        variants = _title_query_variants("πυρετο")
        self.assertIn("πυρετο", variants)
        self.assertIn("πυρετ", variants)

    def test_expand_fever_includes_greek(self):
        expanded = expand_anchors_for_match(["fever"])
        self.assertIn("fever", expanded)
        self.assertTrue(any(x.startswith("πυρετ") for x in expanded))


if __name__ == "__main__":
    unittest.main()
