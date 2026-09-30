"""Smoke tests for support_messages validation helpers."""
import unittest

import support_messages as sm


class SupportMessagesTests(unittest.TestCase):
    def test_validate_email(self):
        self.assertEqual(sm.validate_email("  Mom@Heymaa.ai "), "mom@heymaa.ai")
        with self.assertRaises(ValueError):
            sm.validate_email("not-an-email")

    def test_validate_body_and_subject(self):
        self.assertIn("hello", sm.validate_body("hello world more"))
        with self.assertRaises(ValueError):
            sm.validate_body("short")
        self.assertEqual(sm.validate_subject("Billing help"), "Billing help")
        with self.assertRaises(ValueError):
            sm.validate_subject("hi")

    def test_category(self):
        self.assertEqual(sm.validate_category("billing"), "billing")
        with self.assertRaises(ValueError):
            sm.validate_category("spam")


if __name__ == "__main__":
    unittest.main()
