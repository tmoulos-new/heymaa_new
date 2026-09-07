"""Tests for stackable plan grants."""
from datetime import datetime, timedelta, timezone

from plan_grants import (
    LEVEL_REWARD_GRANTS,
    _stack_starts_at,
    effective_grant_plan_slot,
    pending_level_rewards,
    resolve_grant_terms,
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
    assert LEVEL_REWARD_GRANTS[2]["days"] == 3
    assert LEVEL_REWARD_GRANTS[3]["days"] == 7
    assert LEVEL_REWARD_GRANTS[5]["plan_slot"] == "premium"
    assert LEVEL_REWARD_GRANTS[5]["days"] == 7


def test_starter_reward_upgrades_for_active_premium_subscriber():
    now = datetime.now(timezone.utc)
    sub_end = now + timedelta(days=20)
    user_row = {
        "plan": "premium",
        "subscription_status": "active",
        "subscription_ends_at": sub_end.isoformat(),
        "role": "user",
    }
    slot, starts, ends, upgraded, original = resolve_grant_terms(
        user_row,
        [],
        "starter",
        7,
        now=now,
    )
    assert original == "starter"
    assert upgraded is True
    assert slot == "premium"
    assert starts >= sub_end
    assert ends == starts + timedelta(days=7)


def test_starter_reward_applies_immediately_on_trial():
    now = datetime.now(timezone.utc)
    user_row = {
        "plan": "trial",
        "subscription_status": "trial",
        "trial_ends_at": (now + timedelta(days=10)).isoformat(),
        "role": "user",
    }
    slot, starts, ends, upgraded, original = resolve_grant_terms(
        user_row,
        [],
        "starter",
        3,
        now=now,
    )
    assert upgraded is False
    assert slot == "starter"
    assert starts <= now + timedelta(seconds=1)
    assert ends == starts + timedelta(days=3)


def test_same_tier_premium_reward_stacks_after_subscription():
    now = datetime.now(timezone.utc)
    sub_end = now + timedelta(days=15)
    user_row = {
        "plan": "premium",
        "subscription_status": "active",
        "subscription_ends_at": sub_end.isoformat(),
        "role": "user",
    }
    slot, starts, ends, upgraded, _original = resolve_grant_terms(
        user_row,
        [],
        "premium",
        3,
        now=now,
    )
    assert upgraded is False
    assert slot == "premium"
    assert starts >= sub_end
    assert ends == starts + timedelta(days=3)


def test_premium_reward_bumps_starter_subscriber_immediately():
    now = datetime.now(timezone.utc)
    sub_end = now + timedelta(days=15)
    user_row = {
        "plan": "starter",
        "subscription_status": "active",
        "subscription_ends_at": sub_end.isoformat(),
        "role": "user",
    }
    slot, starts, ends, upgraded, _original = resolve_grant_terms(
        user_row,
        [],
        "premium",
        3,
        now=now,
    )
    assert upgraded is False
    assert slot == "premium"
    assert starts <= now + timedelta(seconds=1)
    assert ends == starts + timedelta(days=3)
