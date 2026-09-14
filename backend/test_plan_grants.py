"""Tests for stackable plan grants."""
from datetime import datetime, timedelta, timezone

from plan_grants import (
    LEVEL_REWARD_GRANTS,
    _cfg_from_level_row,
    _stack_starts_at,
    effective_grant_plan_slot,
    load_level_reward_grants,
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


def test_cfg_from_level_row_requires_gift():
    assert _cfg_from_level_row({"id": 2, "reward_plan_slot": "starter", "reward_days": 3}) == {
        "plan_slot": "starter",
        "days": 3,
    }
    assert _cfg_from_level_row({"id": 1, "reward_plan_slot": None, "reward_days": None}) is None
    assert _cfg_from_level_row({"id": 6, "reward_plan_slot": "starter", "reward_days": 0}) is None


class _FakeLevelsTable:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("R", (), {"data": self._rows})()


class _FakeSb:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        assert name == "levels"
        return _FakeLevelsTable(self._rows)


def test_load_level_reward_grants_fallback():
    mapping = load_level_reward_grants(None)
    assert mapping[2]["days"] == 3
    assert mapping[4]["plan_slot"] == "premium"


def test_load_level_reward_grants_from_levels_table():
    mapping = load_level_reward_grants(
        _FakeSb(
            [
                {"id": 1, "reward_plan_slot": None, "reward_days": None},
                {"id": 2, "reward_plan_slot": "starter", "reward_days": 5},
                {"id": 4, "reward_plan_slot": "premium", "reward_days": 2},
            ]
        )
    )
    assert mapping == {
        2: {"plan_slot": "starter", "days": 5},
        4: {"plan_slot": "premium", "days": 2},
    }


def test_pending_uses_live_grant_map():
    custom = {2: {"plan_slot": "premium", "days": 9}}
    pending = pending_level_rewards(3, set(), custom)
    assert pending == [{"level_id": 2, "plan_slot": "premium", "days": 9}]


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
