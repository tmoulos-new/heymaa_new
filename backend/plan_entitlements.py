"""Plan limits — keep voice quotas in sync with frontend/src/lib/voiceQuota.ts and home.json pricing."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

# Monthly TTS «Listen» limits per plan slot
VOICE_LISTEN_QUOTA_BY_PLAN: dict[str, int] = {
    "trial": 50,
    "starter": 150,
    "premium": 400,
    "annual": 700,
}

TTS_USAGE_KEY = "tts_usage"
ADMIN_VOICE_QUOTA = 10_000
INVITE_TESTER_PLAN_SLOT = "premium"


class VoiceQuotaExceeded(Exception):
    def __init__(self, used: int, limit: int):
        self.used = used
        self.limit = limit
        super().__init__(f"Voice quota exceeded ({used}/{limit})")


def current_billing_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def resolve_plan_slot(
    plan: Optional[str],
    subscription_status: Optional[str],
    *,
    is_trial: bool = False,
) -> str:
    plan_raw = (plan or "").lower()
    status = (subscription_status or "").lower()
    if is_trial or status == "trial" or plan_raw == "trial":
        return "trial"
    if "annual" in plan_raw or "year" in plan_raw or "ετήσ" in plan_raw:
        return "annual"
    if "premium" in plan_raw:
        return "premium"
    if "starter" in plan_raw:
        return "starter"
    if status == "active" and plan_raw:
        return "starter"
    return "trial"


def plan_entitlements(plan_slot: str) -> dict[str, Any]:
    full_memory = plan_slot != "trial"
    quota = VOICE_LISTEN_QUOTA_BY_PLAN.get(plan_slot, VOICE_LISTEN_QUOTA_BY_PLAN["trial"])
    return {
        "plan_slot": plan_slot,
        "voice_listen_quota": quota,
        "full_memory": full_memory,
        "memory_video": full_memory,
        "memory_photos": True,
        "memory_text": True,
    }


def _parse_json_value(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return raw
    return raw


def _normalize_tts_usage(raw: Any, period: Optional[str] = None) -> dict[str, Any]:
    period = period or current_billing_period()
    parsed = _parse_json_value(raw)
    if isinstance(parsed, dict):
        stored_period = str(parsed.get("period") or "")
        used = parsed.get("used", 0)
        try:
            used_int = max(0, int(used))
        except Exception:
            used_int = 0
        if stored_period != period:
            return {"period": period, "used": 0}
        return {"period": period, "used": used_int}
    # Legacy client-only counter (ttsused string/int)
    if isinstance(parsed, (int, float)):
        return {"period": period, "used": max(0, int(parsed))}
    if isinstance(parsed, str) and parsed.strip().isdigit():
        return {"period": period, "used": max(0, int(parsed.strip()))}
    return {"period": period, "used": 0}


def plan_context_from_user_row(row: Optional[dict]) -> tuple[str, dict[str, Any]]:
    if not row:
        slot = "trial"
    elif (row.get("role") or "").lower() == "admin":
        slot = "annual"
    else:
        status = (row.get("subscription_status") or "").lower()
        is_trial = status == "trial"
        slot = resolve_plan_slot(row.get("plan"), row.get("subscription_status"), is_trial=is_trial)
    ent = plan_entitlements(slot)
    if row and (row.get("role") or "").lower() == "admin":
        ent = {**ent, "voice_listen_quota": ADMIN_VOICE_QUOTA, "plan_slot": "admin"}
    return slot, ent


def invite_plan_context() -> tuple[str, dict[str, Any]]:
    slot = INVITE_TESTER_PLAN_SLOT
    return slot, plan_entitlements(slot)


def voice_quota_snapshot(usage: dict[str, Any], limit: int) -> dict[str, Any]:
    used = int(usage.get("used") or 0)
    remaining = max(0, limit - used)
    return {
        "period": usage.get("period") or current_billing_period(),
        "used": used,
        "limit": limit,
        "remaining": remaining,
    }


def load_tts_usage(sb, auth: dict) -> dict[str, Any]:
    period = current_billing_period()
    if not sb:
        return {"period": period, "used": 0}
    try:
        if auth.get("kind") == "invite":
            res = (
                sb.table("user_data")
                .select("value")
                .eq("token", auth["token"])
                .eq("key", TTS_USAGE_KEY)
                .limit(1)
                .execute()
            )
        else:
            res = (
                sb.table("user_data")
                .select("value")
                .eq("user_id", auth["user_id"])
                .eq("key", TTS_USAGE_KEY)
                .limit(1)
                .execute()
            )
        row = res.data[0] if res.data else None
        if not row:
            legacy = _load_legacy_tts_used(sb, auth)
            return _normalize_tts_usage(legacy, period)
        return _normalize_tts_usage(row.get("value"), period)
    except Exception:
        return {"period": period, "used": 0}


def _load_legacy_tts_used(sb, auth: dict) -> Any:
    try:
        if auth.get("kind") == "invite":
            res = (
                sb.table("user_data")
                .select("value")
                .eq("token", auth["token"])
                .eq("key", "ttsused")
                .limit(1)
                .execute()
            )
        else:
            res = (
                sb.table("user_data")
                .select("value")
                .eq("user_id", auth["user_id"])
                .eq("key", "ttsused")
                .limit(1)
                .execute()
            )
        if res.data:
            return res.data[0].get("value")
    except Exception:
        pass
    return None


def save_tts_usage(sb, auth: dict, usage: dict[str, Any], updated_at: str) -> None:
    if not sb:
        return
    payload = {"period": usage.get("period"), "used": int(usage.get("used") or 0)}
    fields = {"key": TTS_USAGE_KEY, "value": payload, "updated_at": updated_at}
    if auth.get("kind") == "invite":
        existing = (
            sb.table("user_data")
            .select("key")
            .eq("token", auth["token"])
            .eq("key", TTS_USAGE_KEY)
            .execute()
        )
        if existing.data:
            sb.table("user_data").update(fields).eq("token", auth["token"]).eq("key", TTS_USAGE_KEY).execute()
        else:
            sb.table("user_data").insert({**fields, "token": auth["token"]}).execute()
    else:
        existing = (
            sb.table("user_data")
            .select("key")
            .eq("user_id", auth["user_id"])
            .eq("key", TTS_USAGE_KEY)
            .execute()
        )
        if existing.data:
            sb.table("user_data").update(fields).eq("user_id", auth["user_id"]).eq("key", TTS_USAGE_KEY).execute()
        else:
            sb.table("user_data").insert({**fields, "user_id": auth["user_id"]}).execute()


def get_voice_quota_for_auth(sb, auth: dict, user_row: Optional[dict] = None) -> dict[str, Any]:
    if auth.get("kind") == "invite":
        _, ent = invite_plan_context()
    else:
        _, ent = plan_context_from_user_row(user_row)
    usage = load_tts_usage(sb, auth)
    limit = int(ent.get("voice_listen_quota") or VOICE_LISTEN_QUOTA_BY_PLAN["trial"])
    return voice_quota_snapshot(usage, limit)


def consume_voice_listen(sb, auth: dict, user_row: Optional[dict], updated_at: str) -> dict[str, Any]:
    if auth.get("kind") == "invite":
        _, ent = invite_plan_context()
    else:
        _, ent = plan_context_from_user_row(user_row)
    limit = int(ent.get("voice_listen_quota") or VOICE_LISTEN_QUOTA_BY_PLAN["trial"])
    usage = load_tts_usage(sb, auth)
    used = int(usage.get("used") or 0)
    if used >= limit:
        raise VoiceQuotaExceeded(used, limit)
    usage["used"] = used + 1
    usage["period"] = current_billing_period()
    save_tts_usage(sb, auth, usage, updated_at)
    return voice_quota_snapshot(usage, limit)


def _memory_items(value: Any) -> list:
    parsed = _parse_json_value(value)
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        for key in ("memories", "items", "data"):
            nested = parsed.get(key)
            if isinstance(nested, list):
                return nested
    return []


def validate_memories_payload(value: Any, entitlements: dict[str, Any]) -> Optional[str]:
    if entitlements.get("memory_video"):
        return None
    for item in _memory_items(value):
        if not isinstance(item, dict):
            continue
        video = item.get("video")
        if video and str(video).strip():
            return "Video memories require Full Memory (Starter plan or above)."
    return None


def build_status_payload(sb, auth: dict, subscription: dict) -> dict[str, Any]:
    user_row = None
    if auth.get("kind") == "user" and auth.get("user_id") and sb:
        try:
            res = (
                sb.table("users")
                .select("plan,subscription_status,role")
                .eq("id", auth["user_id"])
                .limit(1)
                .execute()
            )
            user_row = res.data[0] if res.data else None
        except Exception:
            user_row = None
    if auth.get("kind") == "invite":
        _, entitlements = invite_plan_context()
    else:
        _, entitlements = plan_context_from_user_row(user_row)
    voice_quota = get_voice_quota_for_auth(sb, auth, user_row)
    return {
        **subscription,
        "entitlements": entitlements,
        "voice_quota": voice_quota,
    }
