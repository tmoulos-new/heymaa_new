"""Unit tests for chat quality helpers."""
import unittest

from chat_quality import compute_health_score, rule_based_review
from chat_quality_golden import run_golden_suite


class ChatQualityTests(unittest.TestCase):
    def test_local_find_over_refusal(self):
        r = rule_based_review(
            "Βρες μου παιδιάτρους στην περιοχή του Ελληνικού",
            "Δεν έχω πρόσβαση σε λίστα παιδιατρικών κλινικών. Ζήτα από το δίκτυο του δικαστηρίου.",
        )
        self.assertLess(r["score"], 50)
        self.assertIn("over_refusal", r["tags"])
        self.assertIn("hallucination", r["tags"])
        self.assertIn("local_discovery", r["tags"])
        self.assertTrue(r["proposal"])

    def test_good_short_greeting_style(self):
        r = rule_based_review("Γεια σου", "Γεια! Χαίρομαι που γράφεις.")
        self.assertGreaterEqual(r["score"], 75)
        self.assertIn("good", r["tags"])

    def test_health_score_penalizes_downs(self):
        healthy = compute_health_score(up=20, down=0, auto_fail=0, reviewed=20, rule_hits=0)
        sick = compute_health_score(up=5, down=15, auto_fail=10, reviewed=20, rule_hits=8)
        self.assertGreater(healthy["score"], sick["score"])
        self.assertGreaterEqual(healthy["score"], 90)

    def test_golden_suite_passes(self):
        result = run_golden_suite()
        self.assertTrue(result["ok"], msg=str(result.get("cases")))
        self.assertEqual(result["failed"], 0)


if __name__ == "__main__":
    unittest.main()
