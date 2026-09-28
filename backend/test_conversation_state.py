"""Unit tests for conversation_state — run: python -m unittest backend.test_conversation_state"""
from __future__ import annotations

import unittest

from conversation_state import (
    empty_conversation_state,
    format_conversation_state_for_prompt,
    normalize_conversation_state,
    update_conversation_state,
)


class ConversationStateTests(unittest.TestCase):
    def test_normalize_empty(self):
        st = normalize_conversation_state(None)
        self.assertEqual(st["important_facts"], [])
        self.assertIsNone(st["current_topic"])

    def test_correction_flagged(self):
        st = update_conversation_state(
            empty_conversation_state(),
            user_message="Με μπέρδεψες, δεν εννοούσα αυτό.",
            assistant_reply="",
        )
        self.assertTrue(st["user_corrections"])
        self.assertTrue(any("clarify" in q.lower() for q in st["unresolved_questions"]))

    def test_rejection_tracks_advice(self):
        prev = empty_conversation_state()
        prev["advice_given"] = ["Try relaxing music before bed"]
        st = update_conversation_state(
            prev,
            user_message="Δεν βοήθησε καθόλου, δεν θέλει τέτοια.",
            assistant_reply="",
        )
        self.assertTrue(st["rejected_advice"])
        self.assertIn("music", st["rejected_advice"][0].lower())

    def test_age_fact(self):
        st = update_conversation_state(
            {},
            user_message="Είναι 8 χρονών και έρχεται στο κρεβάτι μας.",
        )
        self.assertTrue(st["important_facts"])
        self.assertTrue(st["current_topic"] or st["current_concern"])

    def test_format_prompt_includes_rejected(self):
        text = format_conversation_state_for_prompt(
            {
                "current_topic": "sleep",
                "rejected_advice": ["relaxing music"],
            }
        )
        self.assertIn("sleep", text)
        self.assertIn("Rejected", text)
        self.assertIn("music", text)


if __name__ == "__main__":
    unittest.main()
