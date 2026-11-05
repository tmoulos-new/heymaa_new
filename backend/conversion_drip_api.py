"""Admin-editable conversion drips: never-paid trial users → subscribe.

Sequences/steps are managed in Admin → Conversion drips.
A daily cron enrolls eligible users and sends due steps (email + in-app/push).
"""

from __future__ import annotations

import os
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

_MISSING = (
    "Conversion drip tables are missing. Run backend/migrations/conversion_drips.sql "
    "in the Supabase SQL editor, then try again."
)
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_BATCH_ENROLL = 80
_BATCH_SEND = 40
# Opportunistic ticks (auth/status) — keep cron as primary when available.
_OPPORTUNISTIC_MIN_MINUTES = 45
_LAST_LOCAL_TICK_AT = 0.0


def _main():
    try:
        from . import main as m
    except ImportError:
        import main as m
    return m


def _require_admin(token: Optional[str]) -> str:
    m = _main()
    if not m.ensure_supabase():
        raise HTTPException(status_code=503, detail="Database not configured")
    return str(m.verify_admin(token))


def _missing_table(exc: Exception) -> bool:
    text = str(exc).lower()
    return "conversion_" in text or "42p01" in text or "does not exist" in text


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


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


def _absolute_link(url: Optional[str]) -> Optional[str]:
    raw = (url or "").strip()
    if not raw:
        return None
    if raw.startswith("https://") or raw.startswith("http://"):
        return raw
    if raw.startswith("/") and not raw.startswith("//"):
        base = (os.getenv("APP_URL") or "https://www.heymaa.ai").rstrip("/")
        return base + raw
    return None


def _gift_app_url(code: str) -> str:
    base = (os.getenv("APP_URL") or "https://www.heymaa.ai").rstrip("/")
    return f"{base}/app?gift={code.strip()}"


# ─── Models ───────────────────────────────────────────────────────────────────


class StepIn(BaseModel):
    step_index: Optional[int] = None
    anchor: str = "enrolled_at"
    offset_hours: int = 0
    channel: str = "both"
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    email_url: Optional[str] = None
    email_button_label: Optional[str] = None
    email_images: list[str] = Field(default_factory=list)
    notif_title: Optional[str] = None
    notif_body: Optional[str] = None
    notif_url: Optional[str] = None
    gift_code: Optional[str] = None
    enabled: bool = True


class SequenceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "draft"
    trigger_type: str = "never_paid_trial"
    langs: list[str] = Field(default_factory=lambda: ["el"])
    # False for conversion: trial→paid emails are product lifecycle, not newsletters.
    require_marketing_consent: bool = False
    min_hours_between_emails: int = 168
    min_hours_between_push: int = 72
    exit_on_paid: bool = True
    exit_on_gift_claim: bool = True
    steps: list[StepIn] = Field(default_factory=list)


class SequenceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    trigger_type: Optional[str] = None
    langs: Optional[list[str]] = None
    require_marketing_consent: Optional[bool] = None
    min_hours_between_emails: Optional[int] = None
    min_hours_between_push: Optional[int] = None
    exit_on_paid: Optional[bool] = None
    exit_on_gift_claim: Optional[bool] = None
    steps: Optional[list[StepIn]] = None


class ManualEnrollRequest(BaseModel):
    user_ids: list[str] = Field(default_factory=list)


# ─── Eligibility helpers ───────────────────────────────────────────────────────


def _paid_user_ids(sb) -> set[str]:
    ids: set[str] = set()
    try:
        offset = 0
        while True:
            res = (
                sb.table("completed_orders")
                .select("user_id")
                .not_.is_("user_id", "null")
                .range(offset, offset + 499)
                .execute()
            )
            batch = list(res.data or [])
            for row in batch:
                uid = str(row.get("user_id") or "")
                if uid:
                    ids.add(uid)
            if len(batch) < 500:
                break
            offset += 500
    except Exception:
        pass
    return ids


def _user_is_paid(sb, user_id: str, user_row: Optional[dict] = None) -> bool:
    row = user_row or {}
    plan = str(row.get("plan") or row.get("plan_id") or "").strip().lower()
    status = str(row.get("subscription_status") or "").strip().lower()
    if plan in ("starter", "premium", "annual") and status in ("active", "cancelled"):
        # cancelled but still in paid period counts as converted for drip exit
        if status == "active":
            return True
    try:
        res = (
            sb.table("completed_orders")
            .select("id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception:
        return False


def _profile_map(sb, user_ids: list[str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    if not user_ids:
        return out
    for i in range(0, len(user_ids), 100):
        chunk = user_ids[i : i + 100]
        try:
            res = (
                sb.table("profiles")
                .select("id,lang,consent_marketing,push_alerts_opt_in")
                .in_("id", chunk)
                .execute()
            )
            for row in res.data or []:
                out[str(row.get("id"))] = row
        except Exception:
            continue
    return out


def _recent_channel_send(sb, user_id: str, channel: str, min_hours: int) -> bool:
    if min_hours <= 0:
        return False
    cutoff = (_now() - timedelta(hours=min_hours)).isoformat()
    try:
        res = (
            sb.table("conversion_drip_sends")
            .select("id")
            .eq("user_id", user_id)
            .eq("channel", channel)
            .eq("status", "sent")
            .gte("sent_at", cutoff)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception:
        return False


def _step_due_at(enrollment: dict, step: dict, user_row: dict) -> Optional[datetime]:
    anchor = (step.get("anchor") or "enrolled_at").strip()
    offset = int(step.get("offset_hours") or 0)
    if anchor == "trial_ends_at":
        base = _parse_dt(user_row.get("trial_ends_at") or user_row.get("subscription_ends_at"))
        if not base:
            return None
        return base + timedelta(hours=offset)
    base = _parse_dt(enrollment.get("enrolled_at")) or _now()
    return base + timedelta(hours=offset)


def _resolve_cta(step: dict) -> tuple[Optional[str], Optional[str]]:
    gift = (step.get("gift_code") or "").strip()
    if gift:
        return _gift_app_url(gift), (step.get("email_button_label") or "Claim your gift")
    url = _absolute_link(step.get("email_url") or step.get("notif_url") or "/subscription")
    label = (step.get("email_button_label") or "").strip() or "View plans"
    return url, label


# ─── Send helpers ──────────────────────────────────────────────────────────────


def _send_drip_email(sb, *, user: dict, step: dict, sequence_id: str, step_id: str, enrollment_id: str) -> tuple[str, Optional[str]]:
    email = str(user.get("email") or "").strip().lower()
    if not email or not _EMAIL_RE.match(email):
        return "skipped", "no valid email"
    subject = (step.get("email_subject") or "").strip()
    body = (step.get("email_body") or "").strip()
    if len(subject) < 2 or len(body) < 2:
        return "skipped", "email content empty"
    m = _main()
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    from_addr = (os.getenv("RESEND_FROM") or "").strip()
    if not api_key or not from_addr:
        return "failed", "Resend not configured"
    link, button = _resolve_cta(step)
    images = []
    for item in step.get("email_images") or []:
        u = str(item or "").strip()
        if u.startswith("https://"):
            images.append(u)
    try:
        try:
            from .email_templates import render_admin_broadcast_email, send_email
        except ImportError:
            from email_templates import render_admin_broadcast_email, send_email
        msg = render_admin_broadcast_email(
            subject=subject,
            body=body,
            link=link,
            button_label=button,
            name=user.get("name"),
            images=images[:4],
        )
        err = send_email(
            api_key=api_key,
            from_address=from_addr,
            to=email,
            message=msg,
            kind="drip",
            campaign_id=sequence_id,
            user_id=str(user.get("id") or ""),
            to_name=user.get("name"),
            tags={"sequence": sequence_id[:36], "step": step_id[:36]},
        )
        if err:
            return "failed", err[:400]
        sb.table("conversion_drip_sends").insert(
            {
                "enrollment_id": enrollment_id,
                "sequence_id": sequence_id,
                "step_id": step_id,
                "user_id": str(user["id"]),
                "channel": "email",
                "status": "sent",
                "subject_or_title": subject[:200],
                "body": body[:4000],
                "url": link,
                "sent_at": _now_iso(),
            }
        ).execute()
        return "sent", None
    except Exception as e:
        return "failed", str(e)[:400]


def _send_drip_notification(sb, *, user: dict, step: dict, sequence_id: str, step_id: str, enrollment_id: str) -> tuple[str, Optional[str]]:
    title = (step.get("notif_title") or "").strip()
    body = (step.get("notif_body") or "").strip()
    if len(title) < 2 or len(body) < 2:
        return "skipped", "notification content empty"
    gift = (step.get("gift_code") or "").strip()
    url = _gift_app_url(gift) if gift else _absolute_link(step.get("notif_url") or step.get("email_url") or "/subscription")
    uid = str(user.get("id") or "")
    now = _now_iso()
    try:
        note = {
            "title": title[:120],
            "body": body[:500],
            "url": url,
            "audience": "selected",
            "audience_label": "conversion drip",
            "created_by": "drip",
            "created_at": now,
            "recipient_count": 1,
        }
        ins = sb.table("app_notifications").insert(note).execute()
        note_id = (ins.data or [{}])[0].get("id")
        if not note_id:
            return "failed", "notification insert failed"
        sb.table("app_notification_recipients").insert(
            {"notification_id": note_id, "user_id": uid, "created_at": now}
        ).execute()
        # Best-effort web push
        try:
            try:
                from .push_delivery import send_web_push
            except ImportError:
                from push_delivery import send_web_push
            try:
                from .app_notifications_api import _subscriptions_for
            except ImportError:
                from app_notifications_api import _subscriptions_for
            subs = _subscriptions_for(sb, [uid])
            for sub in subs:
                try:
                    send_web_push(
                        sub,
                        title=title[:120],
                        body=body[:500],
                        url=url or "/app",
                        tag="heymaa-drip",
                    )
                except Exception:
                    pass
        except Exception:
            pass
        sb.table("conversion_drip_sends").insert(
            {
                "enrollment_id": enrollment_id,
                "sequence_id": sequence_id,
                "step_id": step_id,
                "user_id": uid,
                "channel": "notification",
                "status": "sent",
                "subject_or_title": title[:200],
                "body": body[:2000],
                "url": url,
                "notification_id": note_id,
                "sent_at": now,
            }
        ).execute()
        return "sent", None
    except Exception as e:
        return "failed", str(e)[:400]


# ─── Engine ────────────────────────────────────────────────────────────────────


def _load_steps(sb, sequence_id: str) -> list[dict]:
    res = (
        sb.table("conversion_sequence_steps")
        .select("*")
        .eq("sequence_id", sequence_id)
        .eq("enabled", True)
        .order("step_index")
        .execute()
    )
    return list(res.data or [])


def _exit_enrollment(sb, enrollment_id: str, reason: str) -> None:
    sb.table("conversion_enrollments").update(
        {"status": "exited", "exited_reason": reason[:120]}
    ).eq("id", enrollment_id).execute()


def exit_enrollments_on_gift_claim(sb, user_id: str, gift_code: Optional[str] = None) -> int:
    """Exit active drips that use this gift code (or any gift-code step if code omitted)."""
    exited = 0
    code = (gift_code or "").strip()
    try:
        enr = (
            sb.table("conversion_enrollments")
            .select("id,sequence_id")
            .eq("user_id", user_id)
            .eq("status", "active")
            .execute()
        )
    except Exception:
        return 0
    for row in enr.data or []:
        seq_id = row.get("sequence_id")
        try:
            seq = (
                sb.table("conversion_sequences")
                .select("id,exit_on_gift_claim")
                .eq("id", seq_id)
                .limit(1)
                .execute()
            )
            seq_row = (seq.data or [None])[0]
            if not seq_row or not seq_row.get("exit_on_gift_claim", True):
                continue
            steps = (
                sb.table("conversion_sequence_steps")
                .select("gift_code")
                .eq("sequence_id", seq_id)
                .execute()
            )
            codes = {
                str(s.get("gift_code") or "").strip()
                for s in (steps.data or [])
                if (s.get("gift_code") or "").strip()
            }
            if not codes:
                continue
            if code and code not in codes:
                continue
            _exit_enrollment(sb, row["id"], f"gift_claimed:{code or 'any'}")
            exited += 1
        except Exception:
            continue
    return exited


def _advance_enrollment(sb, enrollment: dict, steps: list[dict], next_index: int, user_row: dict) -> None:
    if next_index >= len(steps):
        sb.table("conversion_enrollments").update(
            {
                "status": "completed",
                "next_step_index": next_index,
                "last_step_sent_at": _now_iso(),
            }
        ).eq("id", enrollment["id"]).execute()
        return
    nxt = steps[next_index]
    due = _step_due_at(enrollment, nxt, user_row) or (_now() + timedelta(hours=1))
    # Never schedule in the past for future steps relative to now
    if due < _now():
        due = _now() + timedelta(minutes=5)
    sb.table("conversion_enrollments").update(
        {
            "next_step_index": next_index,
            "next_run_at": due.isoformat(),
            "last_step_sent_at": _now_iso(),
        }
    ).eq("id", enrollment["id"]).execute()


def process_due_enrollments(sb, *, limit: int = _BATCH_SEND) -> dict[str, Any]:
    stats = {"processed": 0, "sent_email": 0, "sent_notif": 0, "skipped": 0, "exited": 0, "errors": 0}
    now = _now_iso()
    try:
        due = (
            sb.table("conversion_enrollments")
            .select("*")
            .eq("status", "active")
            .lte("next_run_at", now)
            .order("next_run_at")
            .limit(max(1, min(limit, 80)))
            .execute()
        )
    except Exception as e:
        if _missing_table(e):
            return {"ok": False, "error": _MISSING, **stats}
        return {"ok": False, "error": str(e)[:200], **stats}

    for enrollment in due.data or []:
        stats["processed"] += 1
        seq_id = enrollment["sequence_id"]
        uid = enrollment["user_id"]
        try:
            seq_res = sb.table("conversion_sequences").select("*").eq("id", seq_id).limit(1).execute()
            seq = (seq_res.data or [None])[0]
            if not seq or seq.get("status") != "active":
                _exit_enrollment(sb, enrollment["id"], "sequence_inactive")
                stats["exited"] += 1
                continue
            user_res = (
                sb.table("users")
                .select("id,email,name,plan,plan_id,subscription_status,trial_ends_at,subscription_ends_at")
                .eq("id", uid)
                .limit(1)
                .execute()
            )
            user = (user_res.data or [None])[0]
            if not user:
                _exit_enrollment(sb, enrollment["id"], "user_missing")
                stats["exited"] += 1
                continue
            if seq.get("exit_on_paid") and _user_is_paid(sb, uid, user):
                _exit_enrollment(sb, enrollment["id"], "converted_paid")
                stats["exited"] += 1
                continue
            steps = _load_steps(sb, seq_id)
            if seq.get("exit_on_gift_claim", True):
                try:
                    step_codes = {
                        str(s.get("gift_code") or "").strip()
                        for s in steps
                        if (s.get("gift_code") or "").strip()
                    }
                    if step_codes:
                        claimed = (
                            sb.table("gift_claims")
                            .select("gift_code_id")
                            .eq("user_id", uid)
                            .limit(50)
                            .execute()
                        )
                        gift_ids = [
                            r.get("gift_code_id") for r in (claimed.data or []) if r.get("gift_code_id")
                        ]
                        if gift_ids:
                            gres = (
                                sb.table("gift_codes")
                                .select("code")
                                .in_("id", gift_ids[:50])
                                .execute()
                            )
                            claimed_codes = {
                                str(g.get("code") or "").strip() for g in (gres.data or [])
                            }
                            if claimed_codes & step_codes:
                                _exit_enrollment(sb, enrollment["id"], "gift_claimed")
                                stats["exited"] += 1
                                continue
                except Exception:
                    pass
            idx = int(enrollment.get("next_step_index") or 0)
            if idx >= len(steps):
                sb.table("conversion_enrollments").update({"status": "completed"}).eq("id", enrollment["id"]).execute()
                continue
            step = steps[idx]
            due_at = _step_due_at(enrollment, step, user)
            if due_at and due_at > _now() + timedelta(minutes=2):
                sb.table("conversion_enrollments").update({"next_run_at": due_at.isoformat()}).eq(
                    "id", enrollment["id"]
                ).execute()
                stats["skipped"] += 1
                continue

            channel = (step.get("channel") or "both").lower()
            profiles = _profile_map(sb, [uid])
            prof = profiles.get(uid) or {}
            # When require_marketing_consent is on, email needs opt-in; push/in-app always ok.
            # Conversion sequences default this OFF so trial→paid emails always go out.
            consent_ok = (
                bool(prof.get("consent_marketing"))
                if seq.get("require_marketing_consent", False)
                else True
            )
            want_email = channel in ("email", "both")
            want_notif = channel in ("notification", "both")
            email_allowed = want_email and consent_ok
            email_capped = email_allowed and _recent_channel_send(
                sb, uid, "email", int(seq.get("min_hours_between_emails") or 168)
            )
            notif_capped = want_notif and _recent_channel_send(
                sb, uid, "notification", int(seq.get("min_hours_between_push") or 72)
            )
            # If every channel we can send is rate-capped, defer instead of skipping the step.
            can_email = email_allowed and not email_capped
            can_notif = want_notif and not notif_capped
            if (email_allowed or want_notif) and not can_email and not can_notif and (email_capped or notif_capped):
                defer_h = 12
                if email_capped:
                    defer_h = max(defer_h, min(24, int(seq.get("min_hours_between_emails") or 168) // 7 or 24))
                if notif_capped:
                    defer_h = max(defer_h, min(24, int(seq.get("min_hours_between_push") or 72) // 3 or 12))
                sb.table("conversion_enrollments").update(
                    {"next_run_at": (_now() + timedelta(hours=defer_h)).isoformat()}
                ).eq("id", enrollment["id"]).execute()
                stats["skipped"] += 1
                continue

            if can_email:
                st, err = _send_drip_email(
                    sb,
                    user=user,
                    step=step,
                    sequence_id=seq_id,
                    step_id=step["id"],
                    enrollment_id=enrollment["id"],
                )
                if st == "sent":
                    stats["sent_email"] += 1
                elif st == "failed":
                    stats["errors"] += 1
                    sb.table("conversion_drip_sends").insert(
                        {
                            "enrollment_id": enrollment["id"],
                            "sequence_id": seq_id,
                            "step_id": step["id"],
                            "user_id": uid,
                            "channel": "email",
                            "status": "failed",
                            "last_error": err,
                            "sent_at": _now_iso(),
                        }
                    ).execute()
            elif want_email and not consent_ok:
                stats["skipped"] += 1  # email skipped — notif may still send

            if can_notif:
                st, err = _send_drip_notification(
                    sb,
                    user=user,
                    step=step,
                    sequence_id=seq_id,
                    step_id=step["id"],
                    enrollment_id=enrollment["id"],
                )
                if st == "sent":
                    stats["sent_notif"] += 1
                elif st == "failed":
                    stats["errors"] += 1

            _advance_enrollment(sb, enrollment, steps, idx + 1, user)
        except Exception:
            stats["errors"] += 1
    return {"ok": True, **stats}


def enroll_eligible_users(sb, *, limit: int = _BATCH_ENROLL) -> dict[str, Any]:
    """Auto-enroll never-paid trial users into active sequences matching their lang."""
    stats = {"enrolled": 0, "skipped": 0, "sequences": 0}
    try:
        seqs = (
            sb.table("conversion_sequences")
            .select("*")
            .eq("status", "active")
            .eq("trigger_type", "never_paid_trial")
            .execute()
        )
    except Exception as e:
        if _missing_table(e):
            return {"ok": False, "error": _MISSING, **stats}
        return {"ok": False, "error": str(e)[:200], **stats}

    sequences = list(seqs.data or [])
    stats["sequences"] = len(sequences)
    if not sequences:
        return {"ok": True, **stats}

    paid = _paid_user_ids(sb)
    # Candidates: trial-ish users
    try:
        users_res = (
            sb.table("users")
            .select("id,email,name,plan,plan_id,subscription_status,trial_ends_at,created_at")
            .or_("plan.eq.trial,plan_id.eq.trial,subscription_status.eq.trial")
            .order("created_at", desc=True)
            .limit(400)
            .execute()
        )
        candidates = [u for u in (users_res.data or []) if str(u.get("id")) not in paid]
    except Exception as e:
        return {"ok": False, "error": str(e)[:200], **stats}

    profiles = _profile_map(sb, [str(u["id"]) for u in candidates if u.get("id")])
    enrolled_n = 0
    for seq in sequences:
        if enrolled_n >= limit:
            break
        langs = {str(x).lower() for x in (seq.get("langs") or ["el"])}
        # already enrolled user ids for this sequence
        existing: set[str] = set()
        try:
            er = (
                sb.table("conversion_enrollments")
                .select("user_id")
                .eq("sequence_id", seq["id"])
                .execute()
            )
            existing = {str(r.get("user_id")) for r in (er.data or [])}
        except Exception:
            pass
        steps = _load_steps(sb, seq["id"])
        if not steps:
            continue
        for user in candidates:
            if enrolled_n >= limit:
                break
            uid = str(user.get("id") or "")
            if not uid or uid in existing:
                stats["skipped"] += 1
                continue
            prof = profiles.get(uid) or {}
            lang = str(prof.get("lang") or "el").lower().split("-")[0]
            if lang not in langs:
                continue
            # Marketing consent gates email only (at send time), not enrollment.
            # Users without consent still get in-app / push drip steps.
            first = steps[0]
            due = _step_due_at(
                {"enrolled_at": _now_iso()},
                first,
                user,
            ) or (_now() + timedelta(hours=max(0, int(first.get("offset_hours") or 0))))
            try:
                sb.table("conversion_enrollments").insert(
                    {
                        "sequence_id": seq["id"],
                        "user_id": uid,
                        "status": "active",
                        "enrolled_at": _now_iso(),
                        "next_step_index": 0,
                        "next_run_at": due.isoformat(),
                    }
                ).execute()
                enrolled_n += 1
                stats["enrolled"] += 1
                existing.add(uid)
            except Exception:
                stats["skipped"] += 1
    return {"ok": True, **stats}


def _mark_engine_tick(sb, source: str) -> None:
    """Bump active sequence updated_at so multi-instance auth/status can throttle."""
    global _LAST_LOCAL_TICK_AT
    _LAST_LOCAL_TICK_AT = time.time()
    try:
        sb.table("conversion_sequences").update({"updated_at": _now_iso()}).eq(
            "status", "active"
        ).execute()
    except Exception:
        pass
    _ = source  # reserved for future runtime logging


def _should_skip_opportunistic_tick(sb, min_interval_minutes: int) -> bool:
    global _LAST_LOCAL_TICK_AT
    if time.time() - _LAST_LOCAL_TICK_AT < min_interval_minutes * 60:
        return True
    try:
        active = (
            sb.table("conversion_sequences")
            .select("id")
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if not active.data:
            return True
        cutoff = (_now() - timedelta(minutes=min_interval_minutes)).isoformat()
        recent = (
            sb.table("conversion_sequences")
            .select("id")
            .eq("status", "active")
            .gte("updated_at", cutoff)
            .limit(1)
            .execute()
        )
        # If any active sequence was touched recently (tick or admin save), wait.
        return bool(recent.data)
    except Exception:
        return True


def run_drip_tick(sb, *, source: str = "manual") -> dict[str, Any]:
    _mark_engine_tick(sb, source)
    enroll = enroll_eligible_users(sb)
    send = process_due_enrollments(sb)
    return {"ok": True, "source": source, "enroll": enroll, "send": send}


def maybe_run_drip_tick(
    sb,
    *,
    source: str = "auth_status",
    min_interval_minutes: int = _OPPORTUNISTIC_MIN_MINUTES,
) -> Optional[dict[str, Any]]:
    """Backup scheduler for Hobby/free: run on app traffic when due, throttled.

    Cron remains the preferred daily trigger; this fills gaps when cron is unavailable.
    """
    if sb is None:
        return None
    if _should_skip_opportunistic_tick(sb, min_interval_minutes):
        return None
    try:
        return run_drip_tick(sb, source=source)
    except Exception:
        return None


# ─── Seed defaults ─────────────────────────────────────────────────────────────


def _default_steps_el() -> list[dict]:
    return [
        {
            "step_index": 0,
            "anchor": "enrolled_at",
            "offset_hours": 72,
            "channel": "both",
            "email_subject": "Η HeyMaa είναι εδώ για τις καθημερινές σου απορίες",
            "email_body": (
                "Γεια σου {name},\n\n"
                "Οι πρώτες μέρες με μωρό (ή στην εγκυμοσύνη) γεμίζουν ερωτήσεις. "
                "Η HeyMaa σου απαντά με αξιόπιστη καθοδήγηση και πηγές — "
                "και θυμάται το δικό σου προφίλ οικογένειας.\n\n"
                "Άνοιξε την εφαρμογή και ρώτα ό,τι σε απασχολεί σήμερα."
            ),
            "email_url": "/app",
            "email_button_label": "Άνοιξε τη HeyMaa",
            "notif_title": "Ρώτα ό,τι σε απασχολεί",
            "notif_body": "Η HeyMaa είναι εδώ με αξιόπιστες απαντήσεις για σένα και το μωρό σου.",
            "notif_url": "/app",
            "enabled": True,
        },
        {
            "step_index": 1,
            "anchor": "enrolled_at",
            "offset_hours": 168,
            "channel": "both",
            "email_subject": "Ένα δωράκι για να συνεχίσεις με τη HeyMaa",
            "email_body": (
                "Γεια σου {name},\n\n"
                "Αν η δοκιμή σου τελειώνει σύντομα, μπορείς να συνεχίσεις με συνδρομή "
                "και να κρατήσεις συνομιλίες, αναμνήσεις και έγγραφα σε ένα ήρεμο μέρος.\n\n"
                "Σου έχουμε και δώρο ημερών — πάτησε το κουμπί για να το δεις."
            ),
            "email_url": "/subscription",
            "email_button_label": "Πάρε 7 δωρεάν ημέρες",
            "notif_title": "Δώρο 7 ημερών + συνδρομή",
            "notif_body": "Συνέχισε με ήρεμη υποστήριξη κάθε μέρα. Άνοιξε για το δώρο σου.",
            "notif_url": "/subscription",
            "enabled": True,
        },
        {
            "step_index": 2,
            "anchor": "trial_ends_at",
            "offset_hours": -48,
            "channel": "both",
            "email_subject": "Η δοκιμή σου τελειώνει σε ~2 ημέρες",
            "email_body": (
                "Γεια σου {name},\n\n"
                "Σε περίπου δύο ημέρες τελειώνει η δωρεάν δοκιμή. "
                "Με συνδρομή κρατάς την HeyMaa δίπλα σου για καθημερινές απορίες, "
                "αναμνήσεις και οικογενειακά αρχεία.\n\n"
                "Επίλεξε πλάνο πριν λήξει η πρόσβαση."
            ),
            "email_url": "/subscription",
            "email_button_label": "Επίλεξε πλάνο",
            "notif_title": "Η δοκιμή τελειώνει σύντομα",
            "notif_body": "Κράτα την HeyMaa δίπλα σου — δες τα πλάνα συνδρομής.",
            "notif_url": "/subscription",
            "enabled": True,
        },
        {
            "step_index": 3,
            "anchor": "trial_ends_at",
            "offset_hours": 24,
            "channel": "both",
            "email_subject": "Η πρόσβαση πάτησε παύση — μπορείς να τη συνεχίσεις",
            "email_body": (
                "Γεια σου {name},\n\n"
                "Η δοκιμαστική περίοδος έληξε. Τα δεδομένα σου παραμένουν ασφαλή. "
                "Με μια συνδρομή ξανανοίγεις συνομιλίες και οικογενειακό χώρο αμέσως.\n\n"
                "Αν θες, χρησιμοποίησε και τον σύνδεσμο δώρου ημερών από την ομάδα μας."
            ),
            "email_url": "/subscription",
            "email_button_label": "Πάρε 7 δωρεάν ημέρες",
            "notif_title": "Συνέχισε όταν είσαι έτοιμη",
            "notif_body": "Η δοκιμή έληξε. Άνοιξε για το δώρο 7 ημερών.",
            "notif_url": "/subscription",
            "enabled": True,
        },
        {
            "step_index": 4,
            "anchor": "trial_ends_at",
            "offset_hours": 168,
            "channel": "email",
            "email_subject": "Τελευταία υπενθύμιση από τη HeyMaa",
            "email_body": (
                "Γεια σου {name},\n\n"
                "Αυτή είναι η τελευταία μας υπενθύμιση. Αν θες ξανά ήρεμη, αξιόπιστη "
                "υποστήριξη για τη μαμά και το μωρό, η HeyMaa σε περιμένει.\n\n"
                "Διαφορετικά, δεν θα σε ξαναενοχλήσουμε με αυτό το θέμα."
            ),
            "email_url": "/subscription",
            "email_button_label": "Επιστροφή στη HeyMaa",
            "notif_title": None,
            "notif_body": None,
            "enabled": True,
        },
    ]


def _default_steps_ro() -> list[dict]:
    return [
        {
            "step_index": 0,
            "anchor": "enrolled_at",
            "offset_hours": 72,
            "channel": "both",
            "email_subject": "HeyMaa e aici pentru întrebările tale de zi cu zi",
            "email_body": (
                "Bună {name},\n\n"
                "Primele zile cu bebelușul (sau în sarcină) aduc multe întrebări. "
                "HeyMaa răspunde cu ghidare de încredere și surse — "
                "și își amintește profilul familiei tale.\n\n"
                "Deschide aplicația și întreabă ce te preocupă azi."
            ),
            "email_url": "/app",
            "email_button_label": "Deschide HeyMaa",
            "notif_title": "Întreabă ce te preocupă",
            "notif_body": "HeyMaa e aici cu răspunsuri de încredere pentru tine și bebeluș.",
            "notif_url": "/app",
            "enabled": True,
        },
        {
            "step_index": 1,
            "anchor": "enrolled_at",
            "offset_hours": 168,
            "channel": "both",
            "email_subject": "Un cadou ca să continui cu HeyMaa",
            "email_body": (
                "Bună {name},\n\n"
                "Dacă perioada de probă se apropie de final, poți continua cu un abonament "
                "și păstra conversațiile, amintirile și documentele într-un loc calm.\n\n"
                "Îți oferim și zile cadou — apasă butonul ca să vezi detaliile."
            ),
            "email_url": "/subscription",
            "email_button_label": "Primește 7 zile cadou",
            "notif_title": "7 zile cadou + abonament",
            "notif_body": "Continuă cu sprijin calm în fiecare zi. Deschide pentru cadoul tău.",
            "notif_url": "/subscription",
            "enabled": True,
        },
        {
            "step_index": 2,
            "anchor": "trial_ends_at",
            "offset_hours": -48,
            "channel": "both",
            "email_subject": "Perioada de probă se termină în ~2 zile",
            "email_body": (
                "Bună {name},\n\n"
                "În aproximativ două zile se termină perioada gratuită. "
                "Cu abonament păstrezi HeyMaa alături pentru întrebări zilnice, "
                "amintiri și documente de familie.\n\n"
                "Alege un plan înainte să expire accesul."
            ),
            "email_url": "/subscription",
            "email_button_label": "Alege un plan",
            "notif_title": "Proba se termină curând",
            "notif_body": "Păstrează HeyMaa alături — vezi planurile de abonament.",
            "notif_url": "/subscription",
            "enabled": True,
        },
        {
            "step_index": 3,
            "anchor": "trial_ends_at",
            "offset_hours": 24,
            "channel": "both",
            "email_subject": "Accesul e pe pauză — îl poți relua",
            "email_body": (
                "Bună {name},\n\n"
                "Perioada de probă s-a încheiat. Datele tale rămân în siguranță. "
                "Cu un abonament redeschizi conversațiile și spațiul familiei imediat.\n\n"
                "Dacă vrei, folosește și linkul cu zile cadou de la echipa noastră."
            ),
            "email_url": "/subscription",
            "email_button_label": "Primește 7 zile cadou",
            "notif_title": "Continuă când ești gata",
            "notif_body": "Proba s-a încheiat. Deschide pentru cele 7 zile cadou.",
            "notif_url": "/subscription",
            "enabled": True,
        },
        {
            "step_index": 4,
            "anchor": "trial_ends_at",
            "offset_hours": 168,
            "channel": "email",
            "email_subject": "Ultima reamintire de la HeyMaa",
            "email_body": (
                "Bună {name},\n\n"
                "Aceasta este ultima noastră reamintire. Dacă vrei din nou sprijin calm "
                "și de încredere pentru mamă și bebeluș, HeyMaa te așteaptă.\n\n"
                "Altfel, nu te vom mai contacta pe acest subiect."
            ),
            "email_url": "/subscription",
            "email_button_label": "Înapoi la HeyMaa",
            "enabled": True,
        },
    ]


# Gift codes used on offer/winback steps (step_index 1 and 3).
_CONVERSION_GIFTS = {
    "el": {
        "code": "TRIAL7-EL",
        "label": "Conversion drip — 7 days Starter (EL)",
        "notes": "Auto-attached to Trial → Paid (EL) offer steps",
    },
    "ro": {
        "code": "TRIAL7-RO",
        "label": "Conversion drip — 7 days Starter (RO)",
        "notes": "Auto-attached to Trial → Paid (RO) offer steps",
    },
}
_GIFT_STEP_INDEXES = (1, 3)  # day-7 offer + post-trial winback


def _ensure_conversion_gift(sb, *, lang: str, admin_id: str = "system") -> str:
    """Create (or reuse) the free-days gift for a conversion drip language."""
    meta = _CONVERSION_GIFTS.get(lang) or _CONVERSION_GIFTS["el"]
    code = meta["code"]
    existing = (
        sb.table("gift_codes")
        .select("code,status,is_deleted")
        .eq("code", code)
        .limit(1)
        .execute()
    )
    if existing.data:
        row = existing.data[0]
        if row.get("is_deleted") or (row.get("status") or "") != "active":
            sb.table("gift_codes").update(
                {
                    "is_deleted": False,
                    "status": "active",
                    "updated_at": _now_iso(),
                }
            ).eq("code", code).execute()
        return code
    sb.table("gift_codes").insert(
        {
            "code": code,
            "status": "active",
            "gift_type": "free_plan_days",
            "plan_slot": "starter",
            "days": 7,
            "points": None,
            "label": meta["label"],
            "notes": meta["notes"],
            "max_claims": None,  # campaign code — unlimited unique claimants
            "claim_count": 0,
            "is_deleted": False,
            "created_by": admin_id if len(admin_id) == 36 else None,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
    ).execute()
    return code


def _attach_gift_to_offer_steps(sb, sequence_id: str, gift_code: str) -> int:
    """Wire gift CTA onto offer/winback steps; leave nurture/final steps alone."""
    updated = 0
    for idx in _GIFT_STEP_INDEXES:
        try:
            sb.table("conversion_sequence_steps").update(
                {"gift_code": gift_code}
            ).eq("sequence_id", sequence_id).eq("step_index", idx).execute()
            updated += 1
        except Exception:
            continue
    return updated


def seed_default_sequences(sb, *, admin_id: str = "system", activate: bool = True) -> dict[str, Any]:
    """Seed EL/RO drips with 7-day Starter gift codes on offer steps; activate when ready."""
    created = []
    for name, langs, steps_fn in (
        ("Trial → Paid (EL)", ["el"], _default_steps_el),
        ("Trial → Paid (RO)", ["ro"], _default_steps_ro),
    ):
        lang = langs[0]
        gift_code = _ensure_conversion_gift(sb, lang=lang, admin_id=admin_id)
        existing = (
            sb.table("conversion_sequences")
            .select("id,status")
            .eq("name", name)
            .limit(1)
            .execute()
        )
        if existing.data:
            seq_id = existing.data[0]["id"]
            attached = _attach_gift_to_offer_steps(sb, seq_id, gift_code)
            if activate:
                sb.table("conversion_sequences").update(
                    {"status": "active", "updated_at": _now_iso()}
                ).eq("id", seq_id).execute()
            created.append(
                {
                    "name": name,
                    "id": seq_id,
                    "skipped": True,
                    "gift_code": gift_code,
                    "gift_steps": attached,
                    "status": "active" if activate else existing.data[0].get("status"),
                }
            )
            continue
        ins = (
            sb.table("conversion_sequences")
            .insert(
                {
                    "name": name,
                    "description": (
                        "Auto drip for never-paid trial users. "
                        f"Offer steps use gift code {gift_code} (7 days Starter). "
                        "Edit copy, timing, gift codes, and channels anytime."
                    ),
                    "status": "active" if activate else "draft",
                    "trigger_type": "never_paid_trial",
                    "langs": langs,
                    "require_marketing_consent": False,
                    "min_hours_between_emails": 168,
                    "min_hours_between_push": 72,
                    "exit_on_paid": True,
                    "exit_on_gift_claim": True,
                    "created_by": admin_id,
                }
            )
            .execute()
        )
        seq_id = (ins.data or [{}])[0].get("id")
        if not seq_id:
            continue
        rows = []
        for step in steps_fn():
            row = {**step, "sequence_id": seq_id, "email_images": []}
            if int(step.get("step_index") or 0) in _GIFT_STEP_INDEXES:
                row["gift_code"] = gift_code
                if lang == "el":
                    row["email_button_label"] = row.get("email_button_label") or "Πάρε το δώρο"
                elif lang == "ro":
                    row["email_button_label"] = row.get("email_button_label") or "Ia cadoul"
            rows.append(row)
        if rows:
            sb.table("conversion_sequence_steps").insert(rows).execute()
        created.append(
            {
                "name": name,
                "id": seq_id,
                "skipped": False,
                "steps": len(rows),
                "gift_code": gift_code,
                "status": "active" if activate else "draft",
            }
        )
    return {"ok": True, "sequences": created}


# ─── CRUD helpers ──────────────────────────────────────────────────────────────


def _normalize_step(seq_id: str, index: int, step: StepIn | dict) -> dict:
    if isinstance(step, StepIn):
        data = step.model_dump()
    else:
        data = dict(step)
    images = []
    for item in data.get("email_images") or []:
        u = str(item or "").strip()
        if u.startswith("https://") and u not in images:
            images.append(u[:800])
        if len(images) >= 4:
            break
    anchor = (data.get("anchor") or "enrolled_at").strip()
    if anchor not in ("enrolled_at", "trial_ends_at"):
        anchor = "enrolled_at"
    channel = (data.get("channel") or "both").strip().lower()
    if channel not in ("email", "notification", "both"):
        channel = "both"
    return {
        "sequence_id": seq_id,
        "step_index": int(data.get("step_index") if data.get("step_index") is not None else index),
        "anchor": anchor,
        "offset_hours": int(data.get("offset_hours") or 0),
        "channel": channel,
        "email_subject": (data.get("email_subject") or None),
        "email_body": (data.get("email_body") or None),
        "email_url": (data.get("email_url") or None),
        "email_button_label": (data.get("email_button_label") or None),
        "email_images": images,
        "notif_title": (data.get("notif_title") or None),
        "notif_body": (data.get("notif_body") or None),
        "notif_url": (data.get("notif_url") or None),
        "gift_code": ((data.get("gift_code") or "").strip() or None),
        "enabled": bool(data.get("enabled", True)),
    }


def _replace_steps(sb, seq_id: str, steps: list[StepIn] | list[dict]) -> None:
    sb.table("conversion_sequence_steps").delete().eq("sequence_id", seq_id).execute()
    rows = [_normalize_step(seq_id, i, s) for i, s in enumerate(steps or [])]
    if rows:
        sb.table("conversion_sequence_steps").insert(rows).execute()


def _sequence_with_steps(sb, seq_id: str) -> Optional[dict]:
    res = sb.table("conversion_sequences").select("*").eq("id", seq_id).limit(1).execute()
    seq = (res.data or [None])[0]
    if not seq:
        return None
    steps = (
        sb.table("conversion_sequence_steps")
        .select("*")
        .eq("sequence_id", seq_id)
        .order("step_index")
        .execute()
    )
    seq["steps"] = list(steps.data or [])
    try:
        en = (
            sb.table("conversion_enrollments")
            .select("id", count="exact", head=True)
            .eq("sequence_id", seq_id)
            .eq("status", "active")
            .execute()
        )
        seq["active_enrollments"] = int(en.count or 0)
    except Exception:
        seq["active_enrollments"] = 0
    return seq


# ─── Routes ────────────────────────────────────────────────────────────────────


def register_conversion_drip_routes(app: FastAPI) -> None:
    @app.get("/admin/drips/status")
    async def drips_status(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        try:
            sb.table("conversion_sequences").select("id", count="exact", head=True).execute()
            ready = True
            error = None
        except Exception as e:
            ready = False
            error = _MISSING if _missing_table(e) else str(e)[:200]
        return {
            "ok": ready,
            "error": error,
            "caps": {
                "min_hours_between_emails_default": 168,
                "min_hours_between_push_default": 72,
                "note": "Best practice: ≤1 marketing email / week / user; ≤1 drip push / 3 days.",
            },
            "triggers": {
                "cron": "POST /cron/conversion-drips (daily; needs CRON_SECRET on Hobby/Pro)",
                "auth_status": (
                    f"Background tick on /auth/status ~every {_OPPORTUNISTIC_MIN_MINUTES}m "
                    "when someone uses the app (Hobby-safe backup)"
                ),
                "admin": "Admin → Conversion drips → Run tick now",
            },
            "cron_hint": "POST /cron/conversion-drips with header x-cron-secret",
        }

    @app.get("/admin/drips")
    async def list_drips(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        try:
            res = (
                sb.table("conversion_sequences")
                .select("*")
                .order("updated_at", desc=True)
                .limit(100)
                .execute()
            )
            rows = list(res.data or [])
            for row in rows:
                try:
                    c = (
                        sb.table("conversion_enrollments")
                        .select("id", count="exact", head=True)
                        .eq("sequence_id", row["id"])
                        .eq("status", "active")
                        .execute()
                    )
                    row["active_enrollments"] = int(c.count or 0)
                except Exception:
                    row["active_enrollments"] = 0
                try:
                    s = (
                        sb.table("conversion_sequence_steps")
                        .select("id", count="exact", head=True)
                        .eq("sequence_id", row["id"])
                        .execute()
                    )
                    row["step_count"] = int(s.count or 0)
                except Exception:
                    row["step_count"] = 0
            return {"sequences": rows}
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e

    @app.get("/admin/drips/{sequence_id}")
    async def get_drip(sequence_id: str, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        try:
            seq = _sequence_with_steps(sb, sequence_id)
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e
        if not seq:
            raise HTTPException(status_code=404, detail="Sequence not found")
        return {"sequence": seq}

    @app.post("/admin/drips")
    async def create_drip(req: SequenceCreate, x_token: Optional[str] = Header(None)):
        admin_id = _require_admin(x_token)
        sb = _main().sb
        name = (req.name or "").strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name is required")
        status = (req.status or "draft").strip()
        if status not in ("draft", "active", "paused", "archived"):
            status = "draft"
        langs = [str(x).lower().split("-")[0][:8] for x in (req.langs or ["el"]) if x][:8] or ["el"]
        row = {
            "name": name[:120],
            "description": (req.description or "")[:800] or None,
            "status": status,
            "trigger_type": req.trigger_type if req.trigger_type in ("never_paid_trial", "manual") else "never_paid_trial",
            "langs": langs,
            "require_marketing_consent": bool(req.require_marketing_consent),
            "min_hours_between_emails": max(24, min(int(req.min_hours_between_emails or 168), 720)),
            "min_hours_between_push": max(12, min(int(req.min_hours_between_push or 72), 336)),
            "exit_on_paid": bool(req.exit_on_paid),
            "exit_on_gift_claim": bool(req.exit_on_gift_claim),
            "created_by": admin_id,
            "updated_at": _now_iso(),
        }
        try:
            ins = sb.table("conversion_sequences").insert(row).execute()
            seq_id = (ins.data or [{}])[0].get("id")
            if not seq_id:
                raise HTTPException(status_code=500, detail="Insert failed")
            if req.steps:
                _replace_steps(sb, seq_id, req.steps)
            return {"ok": True, "sequence": _sequence_with_steps(sb, seq_id)}
        except HTTPException:
            raise
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e

    @app.put("/admin/drips/{sequence_id}")
    async def update_drip(sequence_id: str, req: SequenceUpdate, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        patch: dict[str, Any] = {"updated_at": _now_iso()}
        if req.name is not None:
            patch["name"] = req.name.strip()[:120]
        if req.description is not None:
            patch["description"] = (req.description or "")[:800] or None
        if req.status is not None and req.status in ("draft", "active", "paused", "archived"):
            patch["status"] = req.status
        if req.trigger_type is not None and req.trigger_type in ("never_paid_trial", "manual"):
            patch["trigger_type"] = req.trigger_type
        if req.langs is not None:
            patch["langs"] = [str(x).lower().split("-")[0][:8] for x in req.langs if x][:8] or ["el"]
        if req.require_marketing_consent is not None:
            patch["require_marketing_consent"] = bool(req.require_marketing_consent)
        if req.min_hours_between_emails is not None:
            patch["min_hours_between_emails"] = max(24, min(int(req.min_hours_between_emails), 720))
        if req.min_hours_between_push is not None:
            patch["min_hours_between_push"] = max(12, min(int(req.min_hours_between_push), 336))
        if req.exit_on_paid is not None:
            patch["exit_on_paid"] = bool(req.exit_on_paid)
        if req.exit_on_gift_claim is not None:
            patch["exit_on_gift_claim"] = bool(req.exit_on_gift_claim)
        try:
            sb.table("conversion_sequences").update(patch).eq("id", sequence_id).execute()
            if req.steps is not None:
                _replace_steps(sb, sequence_id, req.steps)
            seq = _sequence_with_steps(sb, sequence_id)
            if not seq:
                raise HTTPException(status_code=404, detail="Sequence not found")
            return {"ok": True, "sequence": seq}
        except HTTPException:
            raise
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e

    @app.post("/admin/drips/seed-defaults")
    async def seed_drips(x_token: Optional[str] = Header(None)):
        admin_id = _require_admin(x_token)
        sb = _main().sb
        try:
            return seed_default_sequences(sb, admin_id=admin_id)
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e

    @app.post("/admin/drips/run-now")
    async def run_now(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        try:
            return run_drip_tick(sb)
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e

    @app.delete("/admin/drips/{sequence_id}")
    async def delete_drip(sequence_id: str, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        try:
            sb.table("conversion_sequences").delete().eq("id", sequence_id).execute()
            return {"ok": True}
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e

    @app.post("/admin/drips/{sequence_id}/enroll")
    async def manual_enroll(sequence_id: str, req: ManualEnrollRequest, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        ids = [u for u in (req.user_ids or []) if u][:100]
        if not ids:
            raise HTTPException(status_code=400, detail="Select at least one user")
        seq = _sequence_with_steps(sb, sequence_id)
        if not seq:
            raise HTTPException(status_code=404, detail="Sequence not found")
        steps = seq.get("steps") or []
        if not steps:
            raise HTTPException(status_code=400, detail="Add steps before enrolling")
        enrolled = 0
        for uid in ids:
            try:
                user_res = (
                    sb.table("users")
                    .select("id,trial_ends_at,subscription_ends_at")
                    .eq("id", uid)
                    .limit(1)
                    .execute()
                )
                user = (user_res.data or [{}])[0]
                due = _step_due_at({"enrolled_at": _now_iso()}, steps[0], user) or _now()
                sb.table("conversion_enrollments").upsert(
                    {
                        "sequence_id": sequence_id,
                        "user_id": uid,
                        "status": "active",
                        "enrolled_at": _now_iso(),
                        "next_step_index": 0,
                        "next_run_at": due.isoformat(),
                        "exited_reason": None,
                    },
                    on_conflict="sequence_id,user_id",
                ).execute()
                enrolled += 1
            except Exception:
                continue
        return {"ok": True, "enrolled": enrolled}

    @app.get("/admin/drips/{sequence_id}/sends")
    async def list_sends(sequence_id: str, limit: int = 50, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        lim = max(1, min(200, int(limit or 50)))
        try:
            res = (
                sb.table("conversion_drip_sends")
                .select("*")
                .eq("sequence_id", sequence_id)
                .order("sent_at", desc=True)
                .limit(lim)
                .execute()
            )
            return {"sends": res.data or []}
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e

    @app.get("/admin/drips/{sequence_id}/enrollments")
    async def list_enrollments(sequence_id: str, limit: int = 50, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        lim = max(1, min(200, int(limit or 50)))
        try:
            res = (
                sb.table("conversion_enrollments")
                .select("*")
                .eq("sequence_id", sequence_id)
                .order("enrolled_at", desc=True)
                .limit(lim)
                .execute()
            )
            return {"enrollments": res.data or []}
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e

    @app.post("/cron/conversion-drips")
    async def cron_conversion_drips(
        request: Request,
        x_cron_secret: Optional[str] = Header(None, alias="x-cron-secret"),
        authorization: Optional[str] = Header(None),
    ):
        """Vercel cron (or manual) tick: enroll + send due steps + admin daily report.

        Hobby allows one cron — the daily admin digest rides along after drips.
        """
        expected = (os.getenv("CRON_SECRET") or os.getenv("VERCEL_CRON_SECRET") or "").strip()
        got = (x_cron_secret or "").strip()
        if not got and authorization and authorization.lower().startswith("bearer "):
            got = authorization.split(" ", 1)[1].strip()
        # Also accept Vercel cron automatic auth when CRON_SECRET unset in preview
        if expected and got != expected:
            raise HTTPException(status_code=401, detail="Invalid cron secret")
        m = _main()
        if not m.ensure_supabase():
            raise HTTPException(status_code=503, detail="Database not configured")
        drip = run_drip_tick(m.sb, source="cron")
        report: dict = {"ok": False, "skipped": True, "reason": "not_attempted"}
        try:
            try:
                from .admin_daily_report import send_admin_daily_report
            except ImportError:
                from admin_daily_report import send_admin_daily_report
            report = send_admin_daily_report(m.sb, source="cron")
        except Exception as e:
            report = {"ok": False, "error": str(e)[:200]}
        return {"ok": True, "drip": drip, "daily_report": report}

    @app.get("/admin/daily-report/preview")
    async def admin_daily_report_preview(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        try:
            from .admin_daily_report import build_daily_report
        except ImportError:
            from admin_daily_report import build_daily_report
        return build_daily_report(sb)

    @app.post("/admin/daily-report/send")
    async def admin_daily_report_send(x_token: Optional[str] = Header(None)):
        """Force-send the daily digest now (ignores ADMIN_DAILY_REPORT=0)."""
        _require_admin(x_token)
        sb = _main().sb
        try:
            from .admin_daily_report import send_admin_daily_report
        except ImportError:
            from admin_daily_report import send_admin_daily_report
        return send_admin_daily_report(sb, force=True, source="admin")
