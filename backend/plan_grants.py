"""Stackable temporary plan grants (level-up rewards, etc.)."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from plan_entitlements import plan_entitlements, resolve_plan_slot

PLAN_GRANTS_KEY = "plan_grants"
LEVEL_CLAIMS_KEY = "level_rewards_claimed"

# Level id → reward (levels 2–5 only; level 1 has no plan reward)
LEVEL_REWARD_GRANTS: dict[int, dict[str, Any]] = {
    2: {"plan_slot": "starter", "days": 7},
    3: {"plan_slot": "starter", "days": 14},
    4: {"plan_slot": "premium", "days": 7},
    5: {"plan_slot": "premium", "days": 14},
}

PLAN_SLOT_RANK: dict[str, int] = {
    "trial": 0,
    "starter": 1,
    "premium": 2,
    "annual": 3,
    "admin": 4,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _read_user_data_json(sb, user_id: str, key: str) -> Any:
    if not sb or not user_id:
        return None
    try:
        res = (
            sb.table("user_data")
            .select("value")
            .eq("user_id", user_id)
            .eq("key", key)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        raw = res.data[0].get("value")
        if isinstance(raw, (dict, list)):
            return raw
        if isinstance(raw, str):
            return json.loads(raw)
    except Exception:
        pass
    return None


def _write_user_data_json(sb, user_id: str, key: str, value: Any) -> None:
    if not sb or not user_id:
        return
    try:
        sb.table("user_data").upsert(
            {"user_id": user_id, "key": key, "value": value},
            on_conflict="user_id,key",
        ).execute()
    except Exception:
        pass


def get_user_plan_grants(sb, user_id: str) -> list[dict[str, Any]]:
    raw = _read_user_data_json(sb, user_id, PLAN_GRANTS_KEY)
    if not isinstance(raw, list):
        return []
    grants: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, dict) and item.get("ends_at"):
            grants.append(item)
    return grants


def get_claimed_level_ids(sb, user_id: str) -> set[int]:
    raw = _read_user_data_json(sb, user_id, LEVEL_CLAIMS_KEY)
    if not isinstance(raw, list):
        return set()
    out: set[int] = set()
    for x in raw:
        try:
            out.add(int(x))
        except Exception:
            continue
    return out


def _active_grants(grants: list[dict[str, Any]], *, now: Optional[datetime] = None) -> list[dict[str, Any]]:
    now = now or _utcnow()
    active: list[dict[str, Any]] = []
    for grant in grants:
        ends = _parse_dt(grant.get("ends_at"))
        if ends and ends > now:
            active.append(grant)
    return active


def has_active_plan_grant(sb, user_id: str) -> bool:
    return bool(_active_grants(get_user_plan_grants(sb, user_id)))


def _stack_starts_at(grants: list[dict[str, Any]], *, now: Optional[datetime] = None) -> datetime:
    """Stackable: new grant starts after the latest active grant ends (or now)."""
    now = now or _utcnow()
    active = _active_grants(grants, now=now)
    if not active:
        return now
    latest_end = now
    for grant in active:
        ends = _parse_dt(grant.get("ends_at"))
        if ends and ends > latest_end:
            latest_end = ends
    return latest_end


def effective_grant_plan_slot(grants: list[dict[str, Any]], *, now: Optional[datetime] = None) -> Optional[str]:
    active = _active_grants(grants, now=now)
    if not active:
        return None
    best = "trial"
    best_rank = -1
    for grant in active:
        slot = str(grant.get("plan_slot") or "starter").lower()
        rank = PLAN_SLOT_RANK.get(slot, 0)
        if rank > best_rank:
            best_rank = rank
            best = slot
    return best


def grant_access_ends_at(
    grants: list[dict[str, Any]],
    trial_ends_at: Optional[str] = None,
    subscription_ends_at: Optional[str] = None,
    *,
    now: Optional[datetime] = None,
) -> Optional[str]:
    """Latest access end among active grants, trial, and paid subscription."""
    now = now or _utcnow()
    candidates: list[datetime] = []
    for grant in _active_grants(grants, now=now):
        ends = _parse_dt(grant.get("ends_at"))
        if ends:
            candidates.append(ends)
    trial_end = _parse_dt(trial_ends_at)
    if trial_end and trial_end > now:
        candidates.append(trial_end)
    sub_end = _parse_dt(subscription_ends_at)
    if sub_end and sub_end > now:
        candidates.append(sub_end)
    if not candidates:
        return None
    return max(candidates).isoformat()


def pending_level_rewards(level_id: int, claimed: set[int]) -> list[dict[str, Any]]:
    pending: list[dict[str, Any]] = []
    for lid in sorted(LEVEL_REWARD_GRANTS.keys()):
        if lid <= level_id and lid not in claimed:
            cfg = LEVEL_REWARD_GRANTS[lid]
            pending.append(
                {
                    "level_id": lid,
                    "plan_slot": cfg["plan_slot"],
                    "days": cfg["days"],
                }
            )
    return pending


def rewards_payload(sb, user_id: str, level_id: int) -> dict[str, Any]:
    grants = get_user_plan_grants(sb, user_id)
    claimed = get_claimed_level_ids(sb, user_id)
    active = _active_grants(grants)
    return {
        "pending": pending_level_rewards(level_id, claimed),
        "claimed_level_ids": sorted(claimed),
        "active_grants": [
            {
                "id": g.get("id"),
                "plan_slot": g.get("plan_slot"),
                "starts_at": g.get("starts_at"),
                "ends_at": g.get("ends_at"),
                "source": g.get("source"),
                "level_id": g.get("level_id"),
            }
            for g in active
        ],
    }


def claim_level_reward(sb, user_id: str, level_id: int, current_level_id: int) -> dict[str, Any]:
    level_key = int(level_id)
    if level_key not in LEVEL_REWARD_GRANTS:
        raise ValueError("Invalid reward level")
    if level_key > current_level_id:
        raise ValueError("Level not reached yet")
    claimed = get_claimed_level_ids(sb, user_id)
    if level_key in claimed:
        raise ValueError("Reward already claimed")

    cfg = LEVEL_REWARD_GRANTS[level_key]
    days = int(cfg["days"])
    plan_slot = str(cfg["plan_slot"])

    grants = get_user_plan_grants(sb, user_id)
    starts = _stack_starts_at(grants)
    ends = starts + timedelta(days=days)
    grant = {
        "id": str(uuid.uuid4()),
        "plan_slot": plan_slot,
        "starts_at": starts.isoformat(),
        "ends_at": ends.isoformat(),
        "source": f"level_reward:{level_key}",
        "level_id": level_key,
        "claimed_at": _utcnow().isoformat(),
    }
    grants.append(grant)
    claimed.add(level_key)

    _write_user_data_json(sb, user_id, PLAN_GRANTS_KEY, grants)
    _write_user_data_json(sb, user_id, LEVEL_CLAIMS_KEY, sorted(claimed))

    return {
        "ok": True,
        "grant": grant,
        "rewards": rewards_payload(sb, user_id, current_level_id),
    }


def plan_context_with_grants(
    user_row: Optional[dict],
    grants: list[dict[str, Any]],
) -> tuple[str, dict[str, Any]]:
    base_slot, ent = resolve_plan_slot_from_row(user_row)
    grant_slot = effective_grant_plan_slot(grants)
    if not grant_slot:
        return base_slot, ent
    base_rank = PLAN_SLOT_RANK.get(base_slot, 0)
    grant_rank = PLAN_SLOT_RANK.get(grant_slot, 0)
    if grant_rank > base_rank:
        slot = grant_slot
    else:
        slot = base_slot
    merged = plan_entitlements(slot)
    merged["from_reward_grant"] = grant_rank >= base_rank and grant_slot is not None
    return slot, merged


def resolve_plan_slot_from_row(row: Optional[dict]) -> tuple[str, dict[str, Any]]:
    if not row:
        slot = "trial"
    elif (row.get("role") or "").lower() == "admin":
        from plan_entitlements import ADMIN_VOICE_QUOTA

        slot = "annual"
        ent = plan_entitlements(slot)
        ent = {**ent, "voice_listen_quota": ADMIN_VOICE_QUOTA, "plan_slot": "admin"}
        return "admin", ent
    else:
        status = (row.get("subscription_status") or "").lower()
        is_trial = status == "trial"
        slot = resolve_plan_slot(row.get("plan"), row.get("subscription_status"), is_trial=is_trial)
    return slot, plan_entitlements(slot)


def serialize_active_grants(grants: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": g.get("id"),
            "plan_slot": g.get("plan_slot"),
            "starts_at": g.get("starts_at"),
            "ends_at": g.get("ends_at"),
            "source": g.get("source"),
            "level_id": g.get("level_id"),
        }
        for g in _active_grants(grants)
    ]
