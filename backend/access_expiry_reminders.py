"""Send access-expiry reminder emails (~2 days before end). Triggered on /auth/status."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

REMINDER_SENT_PREFIX = "access_expiry_reminder_"


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


def _days_until(iso: str) -> float:
    end = _parse_dt(iso)
    if not end:
        return 999.0
    return (end - datetime.now(timezone.utc)).total_seconds() / 86400.0


def _reminder_key(access_ends_at: str) -> str:
    day = str(access_ends_at)[:10]
    return f"{REMINDER_SENT_PREFIX}{day}"


def _reminder_already_sent(sb, user_id: str, access_ends_at: str) -> bool:
    key = _reminder_key(access_ends_at)
    try:
        res = (
            sb.table("user_data")
            .select("key")
            .eq("user_id", user_id)
            .eq("key", key)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception:
        return False


def _mark_reminder_sent(sb, user_id: str, access_ends_at: str) -> None:
    key = _reminder_key(access_ends_at)
    try:
        sb.table("user_data").upsert(
            {"user_id": user_id, "key": key, "value": True},
            on_conflict="user_id,key",
        ).execute()
    except Exception:
        pass


def maybe_send_access_expiry_reminder(
    sb,
    *,
    user_id: str,
    email: str,
    name: Optional[str],
    access_ends_at: Optional[str],
    lang: str = "el",
    resend_api_key: str = "",
    resend_from: str = "",
) -> bool:
    """Return True if a reminder email was sent."""
    if not sb or not user_id or not email or not access_ends_at:
        return False
    if not resend_api_key:
        return False

    days = _days_until(access_ends_at)
    # Window: between 1 and 2.5 days before expiry (covers ~48h reminder)
    if days > 2.5 or days < 0.5:
        return False
    if _reminder_already_sent(sb, user_id, access_ends_at):
        return False

    app_url = (os.getenv("APP_URL") or "https://www.heymaa.ai").rstrip("/") + "/app"

    try:
        try:
            from .email_templates import render_access_expiry_reminder_email, send_email
        except ImportError:
            from email_templates import render_access_expiry_reminder_email, send_email

        msg = render_access_expiry_reminder_email(
            name=name,
            access_ends_at=access_ends_at,
            app_url=app_url,
            lang=lang,
        )
        err = send_email(
            api_key=resend_api_key,
            from_address=resend_from,
            to=email.strip().lower(),
            message=msg,
        )
        if err:
            return False
        _mark_reminder_sent(sb, user_id, access_ends_at)
        return True
    except Exception:
        return False
