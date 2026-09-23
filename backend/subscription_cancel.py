"""Subscription cancellation request lifecycle (user request → admin approve/dismiss)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

SUBSCRIPTION_CANCEL_KEY = "subscription_cancel_requested"
CANCEL_STATUSES = frozenset({"pending", "approved", "dismissed"})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return dict(value)
    return {}


def normalize_cancel_record(value: Any) -> Optional[dict]:
    """Return a normalized cancel record, or None if missing/empty."""
    data = _as_dict(value)
    if not data:
        return None
    status = str(data.get("status") or "pending").lower()
    if status not in CANCEL_STATUSES:
        # Legacy rows only had requested_at — treat as pending.
        status = "pending"
    data["status"] = status
    return data


def get_cancel_row(sb, user_id: str) -> Optional[dict]:
    if not sb or not user_id:
        return None
    try:
        res = (
            sb.table("user_data")
            .select("user_id,value,updated_at")
            .eq("user_id", user_id)
            .eq("key", SUBSCRIPTION_CANCEL_KEY)
            .limit(1)
            .execute()
        )
    except Exception:
        return None
    if not res.data:
        return None
    row = res.data[0]
    record = normalize_cancel_record(row.get("value"))
    if not record:
        return None
    return {
        "user_id": row.get("user_id") or user_id,
        "updated_at": row.get("updated_at"),
        "record": record,
    }


def upsert_cancel_record(sb, user_id: str, record: dict) -> dict:
    now = _now_iso()
    payload = dict(record)
    payload.setdefault("status", "pending")
    fields = {"key": SUBSCRIPTION_CANCEL_KEY, "value": payload, "updated_at": now}
    existing = (
        sb.table("user_data")
        .select("key")
        .eq("user_id", user_id)
        .eq("key", SUBSCRIPTION_CANCEL_KEY)
        .limit(1)
        .execute()
    )
    if existing.data:
        sb.table("user_data").update(fields).eq("user_id", user_id).eq(
            "key", SUBSCRIPTION_CANCEL_KEY
        ).execute()
    else:
        sb.table("user_data").insert({**fields, "user_id": user_id}).execute()
    return payload


def delete_cancel_record(sb, user_id: str) -> None:
    try:
        sb.table("user_data").delete().eq("user_id", user_id).eq(
            "key", SUBSCRIPTION_CANCEL_KEY
        ).execute()
    except Exception:
        pass


def cancel_snapshot_fields(row: Optional[dict]) -> dict:
    """Fields merged into /auth/subscription-status for the app UI."""
    if not row:
        return {
            "cancel_requested": False,
            "cancel_status": None,
            "cancel_access_until": None,
        }
    record = row.get("record") or {}
    status = str(record.get("status") or "pending").lower()
    if status == "dismissed":
        return {
            "cancel_requested": False,
            "cancel_status": "dismissed",
            "cancel_access_until": None,
        }
    access_until = (
        record.get("access_until")
        or record.get("subscription_ends_at")
        or None
    )
    return {
        "cancel_requested": status in ("pending", "approved"),
        "cancel_status": status,
        "cancel_access_until": access_until,
    }


def list_cancel_requests(sb, *, status_filter: Optional[str] = "pending") -> list[dict]:
    if not sb:
        return []
    try:
        res = (
            sb.table("user_data")
            .select("user_id,value,updated_at")
            .eq("key", SUBSCRIPTION_CANCEL_KEY)
            .execute()
        )
    except Exception:
        return []
    rows = res.data or []
    user_ids = [r.get("user_id") for r in rows if r.get("user_id")]
    users_by_id: dict[str, dict] = {}
    if user_ids:
        try:
            ures = (
                sb.table("users")
                .select(
                    "id,email,name,plan,plan_id,subscription_status,subscription_ends_at"
                )
                .in_("id", user_ids)
                .execute()
            )
            for u in ures.data or []:
                if u.get("id"):
                    users_by_id[str(u["id"])] = u
        except Exception:
            users_by_id = {}

    out: list[dict] = []
    wanted = (status_filter or "").lower() or None
    if wanted == "all":
        wanted = None
    for r in rows:
        record = normalize_cancel_record(r.get("value"))
        if not record:
            continue
        st = record["status"]
        if wanted and st != wanted:
            continue
        uid = str(r.get("user_id") or "")
        user = users_by_id.get(uid) or {}
        out.append(
            {
                "user_id": uid,
                "email": user.get("email") or record.get("email"),
                "name": user.get("name") or record.get("name"),
                "plan": user.get("plan") or user.get("plan_id") or record.get("plan"),
                "subscription_status": user.get("subscription_status"),
                "subscription_ends_at": user.get("subscription_ends_at"),
                "status": st,
                "requested_at": record.get("requested_at"),
                "approved_at": record.get("approved_at"),
                "dismissed_at": record.get("dismissed_at"),
                "access_until": record.get("access_until")
                or user.get("subscription_ends_at"),
                "immediate": bool(record.get("immediate")),
                "admin_initiated": bool(record.get("admin_initiated")),
                "approved_by": record.get("approved_by"),
                "dismissed_by": record.get("dismissed_by"),
                "note": record.get("note"),
                "updated_at": r.get("updated_at"),
                "record": record,
            }
        )
    out.sort(key=lambda x: x.get("requested_at") or x.get("updated_at") or "", reverse=True)
    return out


def cancel_snapshots_for_users(sb, user_ids: list[str]) -> dict[str, dict]:
    """Map user_id → cancel_snapshot_fields for admin user lists."""
    out: dict[str, dict] = {}
    if not sb or not user_ids:
        return out
    try:
        res = (
            sb.table("user_data")
            .select("user_id,value")
            .eq("key", SUBSCRIPTION_CANCEL_KEY)
            .in_("user_id", user_ids)
            .execute()
        )
    except Exception:
        return out
    for row in res.data or []:
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        record = normalize_cancel_record(row.get("value"))
        if not record:
            continue
        snap = cancel_snapshot_fields({"record": record})
        snap["cancel_requested_at"] = record.get("requested_at")
        snap["cancel_approved_at"] = record.get("approved_at")
        snap["cancel_admin_initiated"] = bool(record.get("admin_initiated"))
        snap["cancel_note"] = record.get("note")
        out[uid] = snap
    return out


def pending_cancel_count(sb) -> int:
    if not sb:
        return 0
    try:
        rows = list_cancel_requests(sb, status_filter="pending")
        return len(rows)
    except Exception:
        return 0


def ensure_subscription_ends_at(sb, user_id: str, plan: Optional[str]) -> Optional[str]:
    """Guarantee users.subscription_ends_at is set; return the ISO end date."""
    try:
        from .subscription_period import subscription_ends_at_iso
    except ImportError:
        from subscription_period import subscription_ends_at_iso

    res = (
        sb.table("users")
        .select("subscription_ends_at,plan,plan_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    row = res.data[0]
    existing = row.get("subscription_ends_at")
    if existing:
        return str(existing)
    plan_key = plan or row.get("plan_id") or row.get("plan") or "starter"
    ends = subscription_ends_at_iso(str(plan_key))
    sb.table("users").update({"subscription_ends_at": ends}).eq("id", user_id).execute()
    return ends
