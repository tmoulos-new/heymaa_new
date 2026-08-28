"""Tests for stackable plan grants."""
from datetime import datetime, timedelta, timezone

from plan_grants import (
    LEVEL_REWARD_GRANTS,
    _stack_starts_at,
    effective_grant_plan_slot,
    pending_level_rewards,
)


def test_pending_rewards_only_unclaimed():
    pending = pending_level_rewards(4, {2})
    assert [p["level_id"] for p in pending] == [3, 4]


def test_stack_extends_from_latest_grant_end():
    now = datetime.now(timezone.utc)
    grants = [
        {
            "plan_slot": "starter",
            "ends_at": (now + timedelta(days=3)).isoformat(),
        }
    ]
    start = _stack_starts_at(grants, now=now)
    assert start >= now + timedelta(days=2)


def test_effective_slot_picks_premium_over_starter():
    now = datetime.now(timezone.utc)
    grants = [
        {"plan_slot": "starter", "ends_at": (now + timedelta(days=5)).isoformat()},
        {"plan_slot": "premium", "ends_at": (now + timedelta(days=2)).isoformat()},
    ]
    assert effective_grant_plan_slot(grants, now=now) == "premium"


def test_level_reward_config():
    assert LEVEL_REWARD_GRANTS[2]["days"] == 7
    assert LEVEL_REWARD_GRANTS[5]["plan_slot"] == "premium"
