"""Unit tests for subscription cancel helpers."""
import unittest

from subscription_cancel import (
    cancel_snapshot_fields,
    normalize_cancel_record,
)


class SubscriptionCancelTests(unittest.TestCase):
    def test_normalize_legacy_pending(self):
        rec = normalize_cancel_record({"requested_at": "2026-01-01T00:00:00+00:00", "plan": "starter"})
        self.assertEqual(rec["status"], "pending")

    def test_snapshot_pending(self):
        snap = cancel_snapshot_fields(
            {"record": {"status": "pending", "subscription_ends_at": "2026-02-01T00:00:00+00:00"}}
        )
        self.assertTrue(snap["cancel_requested"])
        self.assertEqual(snap["cancel_status"], "pending")
        self.assertEqual(snap["cancel_access_until"], "2026-02-01T00:00:00+00:00")

    def test_snapshot_approved(self):
        snap = cancel_snapshot_fields(
            {"record": {"status": "approved", "access_until": "2026-03-01T00:00:00+00:00"}}
        )
        self.assertTrue(snap["cancel_requested"])
        self.assertEqual(snap["cancel_status"], "approved")
        self.assertEqual(snap["cancel_access_until"], "2026-03-01T00:00:00+00:00")

    def test_snapshot_dismissed(self):
        snap = cancel_snapshot_fields({"record": {"status": "dismissed"}})
        self.assertFalse(snap["cancel_requested"])
        self.assertEqual(snap["cancel_status"], "dismissed")

    def test_snapshot_missing(self):
        snap = cancel_snapshot_fields(None)
        self.assertFalse(snap["cancel_requested"])
        self.assertIsNone(snap["cancel_status"])


if __name__ == "__main__":
    unittest.main()
