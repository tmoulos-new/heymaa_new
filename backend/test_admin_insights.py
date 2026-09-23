"""Unit tests for admin insights helpers."""
import unittest
from datetime import date, datetime, timezone

from admin_insights import (
    compute_mrr,
    fill_day_series,
    monthly_price_eur,
    period_still_active,
    project_month_cost,
)


class AdminInsightsHelpersTests(unittest.TestCase):
    def test_monthly_prices(self):
        self.assertEqual(monthly_price_eur("starter"), 19.0)
        self.assertEqual(monthly_price_eur("premium"), 39.0)
        self.assertAlmostEqual(monthly_price_eur("annual"), 199.0 / 12.0, places=3)
        self.assertEqual(monthly_price_eur("trial"), 0.0)

    def test_period_still_active(self):
        now = datetime(2026, 3, 15, tzinfo=timezone.utc)
        self.assertTrue(
            period_still_active(
                "active",
                subscription_ends_at="2026-04-01T00:00:00+00:00",
                now=now,
            )
        )
        self.assertFalse(
            period_still_active(
                "active",
                subscription_ends_at="2026-03-01T00:00:00+00:00",
                now=now,
            )
        )
        self.assertTrue(period_still_active("active", subscription_ends_at=None, now=now))
        self.assertTrue(
            period_still_active(
                "trial",
                trial_ends_at="2026-03-20T00:00:00+00:00",
                now=now,
            )
        )
        self.assertFalse(period_still_active("cancelled", now=now))

    def test_fill_day_series(self):
        series = fill_day_series(
            3,
            {"2026-01-02": 5.0},
            end=date(2026, 1, 3),
        )
        self.assertEqual(len(series), 3)
        self.assertEqual(series[0]["date"], "2026-01-01")
        self.assertEqual(series[0]["value"], 0.0)
        self.assertEqual(series[1]["value"], 5.0)
        self.assertEqual(series[2]["date"], "2026-01-03")

    def test_project_month_cost(self):
        now = datetime(2026, 1, 10, tzinfo=timezone.utc)
        # 10th of 31-day month: 10 / 10 * 31 = 31
        self.assertEqual(project_month_cost(10.0, now=now), 31.0)

    def test_compute_mrr_excludes_pending_cancel_from_renewing(self):
        now = datetime(2026, 3, 15, tzinfo=timezone.utc)
        users = [
            {
                "id": "a",
                "plan_id": "starter",
                "subscription_status": "active",
                "subscription_ends_at": "2026-04-01T00:00:00+00:00",
            },
            {
                "id": "b",
                "plan_id": "premium",
                "subscription_status": "active",
                "subscription_ends_at": "2026-04-01T00:00:00+00:00",
            },
            {
                "id": "c",
                "plan_id": "trial",
                "subscription_status": "trial",
                "trial_ends_at": "2026-04-01T00:00:00+00:00",
            },
        ]
        cancels = {"b": {"cancel_status": "pending", "cancel_requested": True}}
        mrr = compute_mrr(users, cancels, now=now)
        self.assertEqual(mrr["paying_active"], 2)
        self.assertEqual(mrr["recognized_mrr_eur"], 58.0)
        self.assertEqual(mrr["renewing_mrr_eur"], 19.0)
        self.assertEqual(mrr["renewing_count"], 1)


if __name__ == "__main__":
    unittest.main()
