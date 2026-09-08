"""Unit tests for Replicate/admin LLM credit tracking."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import unittest

from llm_usage import (
    apply_credit_sync,
    apply_usage_event,
    bind_state_to_key,
    classify_llm_error,
    empty_state,
    estimate_replicate_cost,
    mask_replicate_token,
    pending_alerts,
    remaining_credit_usd,
    reload_needed,
    replicate_token_identity,
    token_fingerprint,
    usage_snapshot,
)


class LlmUsageTests(unittest.TestCase):
    def test_classify_credit_and_rate_limit(self):
        self.assertEqual(classify_llm_error("HTTP 402: Insufficient credit"), "credit_exhausted")
        self.assertEqual(classify_llm_error("429 rate limit: slow down"), "rate_limit")
        self.assertIsNone(classify_llm_error("prediction timed out"))

    def test_llama_cost_uses_predict_time(self):
        cost = estimate_replicate_cost("meta/meta-llama-3-70b-instruct", 2.0)
        self.assertAlmostEqual(cost, 0.0023, places=4)

    def test_gemini_has_per_call_floor(self):
        cost = estimate_replicate_cost("google/gemini-2.5-flash", 0.4)
        self.assertGreaterEqual(cost, 0.002)

    def test_remaining_and_reload(self):
        state = apply_credit_sync(empty_state(), replicate_balance_usd=10.0, alert_threshold_usd=3.0)
        state = apply_usage_event(state, provider="replicate", ok=True, cost_usd=7.5, model="google/gemini-2.5-flash")
        self.assertAlmostEqual(remaining_credit_usd(state) or 0, 2.5, places=3)
        self.assertTrue(reload_needed(state))

    def test_sync_resets_spent(self):
        state = apply_credit_sync(empty_state(), replicate_balance_usd=20.0)
        state = apply_usage_event(state, provider="replicate", ok=True, cost_usd=1.0)
        state = apply_credit_sync(state, replicate_balance_usd=15.0)
        self.assertEqual(state["spent_since_sync_usd"], 0.0)
        self.assertAlmostEqual(remaining_credit_usd(state) or 0, 15.0, places=3)

    def test_failed_call_does_not_spend(self):
        state = apply_credit_sync(empty_state(), replicate_balance_usd=5.0)
        state = apply_usage_event(
            state,
            provider="replicate",
            ok=False,
            cost_usd=0.0,
            error_kind="credit_exhausted",
            error_msg="402",
        )
        self.assertEqual(state["spent_since_sync_usd"], 0.0)
        self.assertTrue(reload_needed(state))

    def test_pending_alerts_cooldown(self):
        now = datetime(2026, 9, 8, 10, 0, tzinfo=timezone.utc)
        state = apply_credit_sync(
            empty_state(),
            replicate_balance_usd=4.0,
            alert_threshold_usd=5.0,
            daily_budget_usd=1.0,
            now=now,
        )
        state = apply_usage_event(state, provider="replicate", ok=True, cost_usd=1.2, now=now)
        due = pending_alerts(state, now=now)
        self.assertIn("low_balance", due)
        self.assertIn("daily_budget", due)
        state["alerts"] = {"low_balance": now.isoformat(), "daily_budget": now.isoformat()}
        later = pending_alerts(state, now=now + timedelta(hours=1))
        self.assertEqual(later, [])

    def test_snapshot_includes_billing_url(self):
        snap = usage_snapshot(empty_state(), provider_mode="replicate")
        self.assertEqual(snap["provider_mode"], "replicate")
        self.assertIn("replicate.com/account/billing", snap["billing_url"])
        self.assertIn("api-tokens", snap["tokens_url"])
        self.assertEqual(snap["credit_scope"], "heymaa")
        self.assertIn("HeyMaa-only", snap["note"])
        self.assertFalse(snap["reload_needed"])
        self.assertNotIn("replicate_key_mask", snap)
        self.assertNotIn("replicate_key_source", snap)

    def test_embed_and_legacy_do_not_spend_heymaa_key_budget(self):
        state = apply_credit_sync(empty_state(), replicate_balance_usd=10.0)
        state = apply_usage_event(state, provider="gemini_embed", ok=True, cost_usd=0.5)
        state = apply_usage_event(state, provider="groq", ok=True, cost_usd=0.4)
        self.assertEqual(state["spent_since_sync_usd"], 0.0)
        self.assertAlmostEqual(remaining_credit_usd(state) or 0, 10.0, places=3)
        state = apply_usage_event(state, provider="replicate", ok=True, cost_usd=1.0)
        self.assertAlmostEqual(remaining_credit_usd(state) or 0, 9.0, places=3)

    def test_token_mask_hides_secret(self):
        token = "r8_abcdefghijklmnopqrstuvwxyz"
        ident = replicate_token_identity(token, "env:REPLICATE_HEYMAA_API_TOKEN")
        self.assertTrue(ident["mask"].startswith("r8_"))
        self.assertNotIn(token, ident["mask"])
        self.assertNotEqual(ident["fingerprint"], token)
        self.assertEqual(len(token_fingerprint(token)), 20)
        self.assertEqual(mask_replicate_token(""), "not set")

    def test_key_rotation_resets_spend_for_new_token(self):
        a = replicate_token_identity("r8_oldtoken_aaaaaaaa", "env:REPLICATE_HEYMAA_API_TOKEN")
        b = replicate_token_identity("r8_newtoken_bbbbbbbb", "env:REPLICATE_HEYMAA_API_TOKEN")
        state = apply_credit_sync(
            empty_state(),
            replicate_balance_usd=20.0,
            key_identity=a,
        )
        state = apply_usage_event(state, provider="replicate", ok=True, cost_usd=5.0)
        self.assertAlmostEqual(remaining_credit_usd(state) or 0, 15.0, places=3)
        rotated = bind_state_to_key(state, fingerprint=b["fingerprint"], mask=b["mask"], source=b["source"])
        self.assertTrue(rotated["key_rotated"])
        self.assertEqual(rotated["spent_since_sync_usd"], 0.0)
        self.assertEqual(rotated["replicate_key_fp"], b["fingerprint"])
        self.assertEqual(len(rotated["key_history"]), 1)


if __name__ == "__main__":
    unittest.main()
