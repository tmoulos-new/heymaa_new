"""Unit tests for plan_entitlements — run: python -m unittest backend.test_plan_entitlements"""
from __future__ import annotations

import unittest

from plan_entitlements import (
    current_billing_period,
    plan_entitlements,
    resolve_plan_slot,
    validate_docs_payload,
    validate_memories_payload,
    voice_quota_snapshot,
    _normalize_tts_usage,
)


class PlanEntitlementsTests(unittest.TestCase):
    def test_resolve_plan_slot_trial(self):
        self.assertEqual(resolve_plan_slot("trial", "trial", is_trial=True), "trial")

    def test_resolve_plan_slot_starter(self):
        self.assertEqual(resolve_plan_slot("starter", "active"), "starter")

    def test_resolve_plan_slot_annual(self):
        self.assertEqual(resolve_plan_slot("annual premium", "active"), "annual")

    def test_trial_has_photos_no_video(self):
        ent = plan_entitlements("trial")
        self.assertTrue(ent["full_memory"])
        self.assertFalse(ent["memory_video"])
        self.assertTrue(ent["document_archive"])
        self.assertFalse(ent["export_enabled"])
        self.assertEqual(ent["chat_context_messages"], 20)
        self.assertEqual(ent["memory_context_count"], 10)

    def test_starter_has_full_memory(self):
        ent = plan_entitlements("starter")
        self.assertTrue(ent["memory_video"])
        self.assertTrue(ent["full_memory"])
        self.assertTrue(ent["document_archive"])
        self.assertTrue(ent["document_upload"])
        self.assertFalse(ent["export_enabled"])
        self.assertEqual(ent["archived_threads_limit"], 45)
        self.assertEqual(ent["chat_context_messages"], 32)
        self.assertEqual(ent["memory_context_count"], 24)

    def test_premium_export_and_limits(self):
        ent = plan_entitlements("premium")
        self.assertTrue(ent["export_enabled"])
        self.assertEqual(ent["archived_threads_limit"], 90)
        self.assertEqual(ent["chat_context_messages"], 64)
        self.assertEqual(ent["memory_context_count"], 45)

    def test_annual_memory_bonus(self):
        ent = plan_entitlements("annual")
        self.assertEqual(ent["chat_context_messages"], 64)
        self.assertEqual(ent["memory_context_count"], 50)

    def test_trial_has_no_video_memory(self):
        ent = plan_entitlements("trial")
        self.assertFalse(ent["memory_video"])

    def test_starter_has_video_memory(self):
        ent = plan_entitlements("starter")
        self.assertTrue(ent["memory_video"])

    def test_validate_memories_allows_photo_on_trial(self):
        payload = [{"text": "hi", "img": "data:image/png;base64,abc"}]
        err = validate_memories_payload(payload, plan_entitlements("trial"))
        self.assertIsNone(err)

    def test_validate_memories_allows_photo_on_starter(self):
        payload = [{"text": "hi", "img": "data:image/png;base64,abc"}]
        err = validate_memories_payload(payload, plan_entitlements("starter"))
        self.assertIsNone(err)

    def test_validate_memories_blocks_video_on_trial(self):
        payload = [{"text": "hi", "video": "data:video/mp4;base64,abc"}]
        err = validate_memories_payload(payload, plan_entitlements("trial"))
        self.assertIsNotNone(err)

    def test_validate_memories_allows_video_on_starter(self):
        payload = [{"text": "hi", "video": "data:video/mp4;base64,abc"}]
        err = validate_memories_payload(payload, plan_entitlements("starter"))
        self.assertIsNone(err)

    def test_validate_docs_allows_on_trial(self):
        payload = [{"title": "Blood test", "category": "blood", "ref": "", "addedDate": ""}]
        err = validate_docs_payload(payload, plan_entitlements("trial"))
        self.assertIsNone(err)

    def test_validate_docs_allows_metadata_on_starter(self):
        payload = [{"title": "Blood test", "category": "blood", "ref": "", "addedDate": ""}]
        err = validate_docs_payload(payload, plan_entitlements("starter"))
        self.assertIsNone(err)

    def test_validate_docs_allows_file_on_trial(self):
        payload = [{
            "title": "Scan",
            "category": "other",
            "ref": "",
            "addedDate": "",
            "file": {"name": "scan.pdf", "mime": "application/pdf", "dataUrl": "data:application/pdf;base64,abc"},
        }]
        err = validate_docs_payload(payload, plan_entitlements("trial"))
        self.assertIsNone(err)

    def test_validate_docs_allows_file_on_starter(self):
        payload = [{
            "title": "Scan",
            "category": "other",
            "ref": "",
            "addedDate": "",
            "file": {"name": "scan.pdf", "mime": "application/pdf", "dataUrl": "data:application/pdf;base64,abc"},
        }]
        err = validate_docs_payload(payload, plan_entitlements("starter"))
        self.assertIsNone(err)

    def test_tts_usage_resets_on_new_period(self):
        old = {"period": "1999-01", "used": 40}
        normalized = _normalize_tts_usage(old, current_billing_period())
        self.assertEqual(normalized["used"], 0)
        self.assertEqual(normalized["period"], current_billing_period())

    def test_voice_quota_snapshot_remaining(self):
        snap = voice_quota_snapshot({"period": "2026-08", "used": 12}, 50)
        self.assertEqual(snap["remaining"], 38)
        self.assertEqual(snap["limit"], 50)


if __name__ == "__main__":
    unittest.main()
