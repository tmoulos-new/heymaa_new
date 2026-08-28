"""Billing period helpers — keep aligned with Viva plan keys."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

PLAN_BILLING_DAYS: dict[str, int] = {
    "starter": 30,
    "premium": 30,
    "annual": 365,
    "annual_premium": 365,
}


def subscription_period_days(plan: Optional[str]) -> int:
    raw = (plan or "").lower()
    if "annual" in raw or "year" in raw or "ετήσ" in raw:
        return PLAN_BILLING_DAYS["annual"]
    if "premium" in raw:
        return PLAN_BILLING_DAYS["premium"]
    if "starter" in raw:
        return PLAN_BILLING_DAYS["starter"]
    return PLAN_BILLING_DAYS["starter"]


def subscription_ends_at_iso(plan_key: str, *, start: Optional[datetime] = None) -> str:
    start = start or datetime.now(timezone.utc)
    days = subscription_period_days(plan_key)
    return (start + timedelta(days=days)).isoformat()
