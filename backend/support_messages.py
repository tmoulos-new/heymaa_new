"""In-app support contact threads (user ↔ admin)."""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

THREADS = "support_threads"
MESSAGES = "support_messages"

CATEGORIES = ("general", "billing", "technical", "privacy", "other")
STATUSES = ("open", "pending_user", "pending_admin", "closed")

MAX_SUBJECT = 120
MAX_BODY = 4000
MAX_NAME = 80
MAX_NEW_THREADS_PER_DAY = 3
MAX_USER_REPLIES_PER_DAY = 20

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _clean(s: Optional[str], *, max_len: int) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())[:max_len]


def validate_email(email: str) -> str:
    e = (email or "").strip().lower()
    if not e or not _EMAIL_RE.match(e) or len(e) > 200:
        raise ValueError("A valid email is required so we can reply.")
    return e


def validate_category(category: Optional[str]) -> str:
    c = (category or "general").strip().lower()
    if c not in CATEGORIES:
        raise ValueError(f"category must be one of: {', '.join(CATEGORIES)}")
    return c


def validate_subject(subject: str) -> str:
    s = _clean(subject, max_len=MAX_SUBJECT)
    if len(s) < 3:
        raise ValueError("Subject is too short.")
    return s


def validate_body(body: str) -> str:
    b = (body or "").strip()
    if len(b) < 10:
        raise ValueError("Please write a bit more so we can help.")
    if len(b) > MAX_BODY:
        raise ValueError(f"Message is too long (max {MAX_BODY} characters).")
    return b


def _table_missing(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "support_threads" in msg or "support_messages" in msg or "does not exist" in msg or "pgrst" in msg


def migration_hint() -> str:
    return "Run backend/migrations/support_messages.sql in the Supabase SQL editor."


def count_user_threads_since(sb, *, user_id: Optional[str], email: str, since: datetime) -> int:
    try:
        q = sb.table(THREADS).select("id", count="exact").gte("created_at", since.isoformat())
        if user_id:
            q = q.eq("user_id", user_id)
        else:
            q = q.ilike("email", email)
        res = q.execute()
        if getattr(res, "count", None) is not None:
            return int(res.count or 0)
        return len(res.data or [])
    except Exception:
        return 0


def count_user_messages_since(sb, *, thread_id: str, since: datetime) -> int:
    try:
        res = (
            sb.table(MESSAGES)
            .select("id", count="exact")
            .eq("thread_id", thread_id)
            .eq("sender_role", "user")
            .gte("created_at", since.isoformat())
            .execute()
        )
        if getattr(res, "count", None) is not None:
            return int(res.count or 0)
        return len(res.data or [])
    except Exception:
        return 0


def create_thread(
    sb,
    *,
    user_id: Optional[str],
    invite_token: Optional[str],
    email: str,
    name: Optional[str],
    category: str,
    subject: str,
    body: str,
    locale: Optional[str] = "el",
) -> dict[str, Any]:
    email = validate_email(email)
    category = validate_category(category)
    subject = validate_subject(subject)
    body = validate_body(body)
    name_c = _clean(name, max_len=MAX_NAME) or None

    since = _now() - timedelta(hours=24)
    if count_user_threads_since(sb, user_id=user_id, email=email, since=since) >= MAX_NEW_THREADS_PER_DAY:
        raise ValueError(
            f"You already sent {MAX_NEW_THREADS_PER_DAY} messages in the last 24 hours. "
            "Please wait, or email us directly."
        )

    now = _now_iso()
    try:
        tres = (
            sb.table(THREADS)
            .insert(
                {
                    "user_id": user_id,
                    "invite_token": (invite_token or "")[:80] or None,
                    "email": email,
                    "name": name_c,
                    "category": category,
                    "subject": subject,
                    "status": "open",
                    "locale": (locale or "el")[:8],
                    "created_at": now,
                    "updated_at": now,
                    "last_message_at": now,
                }
            )
            .execute()
        )
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError(migration_hint()) from e
        raise
    thread = (tres.data or [None])[0]
    if not thread:
        raise RuntimeError("Failed to create support thread")

    try:
        mres = (
            sb.table(MESSAGES)
            .insert(
                {
                    "thread_id": thread["id"],
                    "sender_role": "user",
                    "body": body,
                    "created_at": now,
                }
            )
            .execute()
        )
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError(migration_hint()) from e
        raise
    message = (mres.data or [None])[0]
    return {"thread": thread, "message": message}


def list_user_threads(sb, *, user_id: Optional[str], email: Optional[str], limit: int = 20) -> list[dict]:
    try:
        q = (
            sb.table(THREADS)
            .select("*")
            .order("last_message_at", desc=True)
            .limit(max(1, min(int(limit or 20), 50)))
        )
        if user_id:
            q = q.eq("user_id", user_id)
        elif email:
            q = q.ilike("email", email.strip().lower())
        else:
            return []
        return list((q.execute().data) or [])
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError(migration_hint()) from e
        raise


def get_thread(sb, thread_id: str) -> Optional[dict]:
    try:
        res = sb.table(THREADS).select("*").eq("id", thread_id).limit(1).execute()
        return (res.data or [None])[0]
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError(migration_hint()) from e
        raise


def list_messages(sb, thread_id: str) -> list[dict]:
    try:
        res = (
            sb.table(MESSAGES)
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at", desc=False)
            .execute()
        )
        return list(res.data or [])
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError(migration_hint()) from e
        raise


def user_can_access(thread: dict, *, user_id: Optional[str], email: Optional[str], invite_token: Optional[str]) -> bool:
    if user_id and thread.get("user_id") and str(thread.get("user_id")) == str(user_id):
        return True
    if invite_token and thread.get("invite_token") and thread.get("invite_token") == invite_token:
        return True
    if email and (thread.get("email") or "").lower() == email.strip().lower():
        return True
    return False


def add_message(
    sb,
    *,
    thread_id: str,
    sender_role: str,
    body: str,
    sender_admin_id: Optional[str] = None,
    new_status: Optional[str] = None,
) -> dict[str, Any]:
    if sender_role not in ("user", "admin", "system"):
        raise ValueError("invalid sender_role")
    body = validate_body(body)
    thread = get_thread(sb, thread_id)
    if not thread:
        raise ValueError("Thread not found")
    if thread.get("status") == "closed" and sender_role == "user":
        raise ValueError("This conversation is closed. Start a new message if you still need help.")

    if sender_role == "user":
        since = _now() - timedelta(hours=24)
        if count_user_messages_since(sb, thread_id=thread_id, since=since) >= MAX_USER_REPLIES_PER_DAY:
            raise ValueError("Too many replies in 24 hours. Please wait or email us.")

    now = _now_iso()
    try:
        mres = (
            sb.table(MESSAGES)
            .insert(
                {
                    "thread_id": thread_id,
                    "sender_role": sender_role,
                    "sender_admin_id": sender_admin_id,
                    "body": body,
                    "created_at": now,
                }
            )
            .execute()
        )
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError(migration_hint()) from e
        raise
    message = (mres.data or [None])[0]
    if not message:
        raise RuntimeError("Failed to save message")

    status = new_status
    if not status:
        if sender_role == "admin":
            status = "pending_user"
        elif sender_role == "user":
            status = "pending_admin" if thread.get("status") != "open" else "open"
    patch: dict[str, Any] = {
        "updated_at": now,
        "last_message_at": now,
    }
    if status and status in STATUSES:
        patch["status"] = status
        if status == "closed":
            patch["closed_at"] = now
            patch["closed_by"] = sender_role
    sb.table(THREADS).update(patch).eq("id", thread_id).execute()
    thread = get_thread(sb, thread_id) or thread
    return {"thread": thread, "message": message}


def set_status(sb, thread_id: str, status: str, *, closed_by: Optional[str] = None) -> dict:
    if status not in STATUSES:
        raise ValueError("invalid status")
    now = _now_iso()
    patch: dict[str, Any] = {"status": status, "updated_at": now}
    if status == "closed":
        patch["closed_at"] = now
        patch["closed_by"] = closed_by or "admin"
    else:
        patch["closed_at"] = None
        patch["closed_by"] = None
    try:
        res = sb.table(THREADS).update(patch).eq("id", thread_id).execute()
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError(migration_hint()) from e
        raise
    return (res.data or [get_thread(sb, thread_id)])[0]


def list_admin_threads(
    sb,
    *,
    status: str = "open",
    limit: int = 50,
) -> list[dict]:
    try:
        q = (
            sb.table(THREADS)
            .select("*")
            .order("last_message_at", desc=True)
            .limit(max(1, min(int(limit or 50), 100)))
        )
        st = (status or "open").strip().lower()
        if st == "open_queue":
            q = q.in_("status", ["open", "pending_admin"])
        elif st != "all":
            if st not in STATUSES:
                raise ValueError("invalid status")
            q = q.eq("status", st)
        return list((q.execute().data) or [])
    except Exception as e:
        if _table_missing(e):
            raise RuntimeError(migration_hint()) from e
        raise


def count_open_queue(sb) -> int:
    try:
        res = (
            sb.table(THREADS)
            .select("id", count="exact")
            .in_("status", ["open", "pending_admin"])
            .execute()
        )
        if getattr(res, "count", None) is not None:
            return int(res.count or 0)
        return len(res.data or [])
    except Exception:
        return 0


def thread_public(row: dict, *, include_preview: bool = False) -> dict:
    out = {
        "id": row.get("id"),
        "subject": row.get("subject"),
        "category": row.get("category"),
        "status": row.get("status"),
        "email": row.get("email"),
        "name": row.get("name"),
        "locale": row.get("locale"),
        "user_id": row.get("user_id"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "last_message_at": row.get("last_message_at"),
        "closed_at": row.get("closed_at"),
    }
    if include_preview:
        out["preview"] = None
    return out


def message_public(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "thread_id": row.get("thread_id"),
        "sender_role": row.get("sender_role"),
        "body": row.get("body"),
        "created_at": row.get("created_at"),
    }
