"""Admin composer for one-off emails, using the same audiences as notifications."""

from __future__ import annotations

import os
import re
import threading
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

_MISSING = (
    "Email history table is missing. Run backend/migrations/admin_email_campaigns.sql "
    "in the Supabase SQL editor, then try again."
)
_MAX_RECIPIENTS = 150
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _main():
    # Vercel loads this file as backend.admin_email_api, so `import main` misses.
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
    return "admin_email" in text or "42p01" in text or "does not exist" in text


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def _mailable(users: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    skipped = 0
    for user in users:
        email = str(user.get("email") or "").strip().lower()
        if not email or not _EMAIL_RE.match(email) or len(email) > 200:
            skipped += 1
            continue
        if email in seen:
            skipped += 1
            continue
        seen.add(email)
        out.append({**user, "email": email})
    return out, skipped


def _clean_images(raw: list[str]) -> list[str]:
    out: list[str] = []
    for item in raw or []:
        url = str(item or "").strip()
        if url.startswith("https://") and len(url) <= 800 and url not in out:
            out.append(url)
        if len(out) >= 4:
            break
    return out


def _deliver(sb, campaign_id: str, users: list[dict[str, Any]], *, subject: str, body: str, link: Optional[str], images: Optional[list[str]] = None) -> None:
    try:
        _deliver_all(sb, campaign_id, users, subject=subject, body=body, link=link, images=images or [])
    except Exception as exc:
        try:
            sb.table("admin_email_campaigns").update(
                {"status": "failed", "last_error": str(exc)[:400], "sent_at": _now()}
            ).eq("id", campaign_id).execute()
        except Exception:
            pass


def _deliver_all(sb, campaign_id: str, users: list[dict[str, Any]], *, subject: str, body: str, link: Optional[str], images: Optional[list[str]] = None) -> None:
    m = _main()
    api_key = (getattr(m, "RESEND_API_KEY", "") or "").strip()
    from_address = (getattr(m, "RESEND_FROM", "") or "HeyMaa <info@heymaa.ai>").strip()
    try:
        from email_templates import render_admin_broadcast_email, send_email
    except ImportError:
        from .email_templates import render_admin_broadcast_email, send_email

    delivered = 0
    failed = 0
    last_error = None
    for user in users:
        message = render_admin_broadcast_email(
            subject=subject,
            body=body,
            link=link,
            name=str(user.get("name") or "").strip() or None,
            images=images,
        )
        err = send_email(
            api_key=api_key,
            from_address=from_address,
            to=str(user["email"]),
            message=message,
        )
        if err:
            failed += 1
            last_error = err[:400]
        else:
            delivered += 1
        if (delivered + failed) % 15 == 0:
            try:
                sb.table("admin_email_campaigns").update(
                    {"delivered": delivered, "failed": failed, "last_error": last_error}
                ).eq("id", campaign_id).execute()
            except Exception:
                pass
    status = "sent" if delivered else "failed"
    try:
        sb.table("admin_email_campaigns").update(
            {
                "status": status,
                "delivered": delivered,
                "failed": failed,
                "last_error": last_error,
                "sent_at": _now(),
            }
        ).eq("id", campaign_id).execute()
    except Exception:
        pass


class EmailSendRequest(BaseModel):
    subject: str
    body: str
    url: Optional[str] = None
    images: list[str] = Field(default_factory=list)
    audience: str = "selected"
    user_ids: list[str] = Field(default_factory=list)
    plan: Optional[str] = None
    sample_name: Optional[str] = None


def register_email_routes(app: FastAPI) -> None:
    @app.get("/admin/emails/status")
    async def admin_email_status(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        m = _main()
        configured = bool((getattr(m, "RESEND_API_KEY", "") or "").strip())
        from_address = (getattr(m, "RESEND_FROM", "") or "HeyMaa <info@heymaa.ai>").strip()
        return {
            "configured": configured,
            "from": from_address if configured else None,
            "max_per_send": _MAX_RECIPIENTS,
        }

    @app.get("/admin/emails")
    async def admin_list_emails(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        try:
            res = (
                sb.table("admin_email_campaigns")
                .select("*")
                .order("created_at", desc=True)
                .limit(40)
                .execute()
            )
        except Exception as e:
            if _missing_table(e):
                return {"emails": [], "error": _MISSING}
            raise HTTPException(status_code=500, detail=str(e)) from e
        return {"emails": res.data or []}

    @app.post("/admin/emails")
    async def admin_send_email(req: EmailSendRequest, x_token: Optional[str] = Header(None)):
        admin_id = _require_admin(x_token)
        m = _main()
        if not (getattr(m, "RESEND_API_KEY", "") or "").strip():
            raise HTTPException(status_code=503, detail="RESEND_API_KEY is not configured on the server.")
        sb = m.sb
        subject = (req.subject or "").strip()
        body = (req.body or "").strip()
        if len(subject) < 2 or len(subject) > 140:
            raise HTTPException(status_code=400, detail="Subject must be 2–140 characters.")
        if len(body) < 2 or len(body) > 4000:
            raise HTTPException(status_code=400, detail="Message must be 2–4000 characters.")
        try:
            from app_notifications_api import _clean_url, _page_users
        except ImportError:
            from .app_notifications_api import _clean_url, _page_users

        stored_url = _clean_url(req.url)
        link = _absolute_link(stored_url)
        images = _clean_images(req.images)
        audience = (req.audience or "selected").strip().lower()
        if audience not in ("selected", "all", "plan"):
            raise HTTPException(status_code=400, detail="audience must be selected, all, or plan")
        plan = (req.plan or "").strip()
        if audience == "plan" and not plan:
            raise HTTPException(status_code=400, detail="Choose a plan or status to target.")
        try:
            users = _page_users(sb, audience=audience, user_ids=req.user_ids, plan=plan)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        mailable, skipped = _mailable(users)
        if not mailable:
            raise HTTPException(status_code=400, detail="No matching people with an email address.")
        if len(mailable) > _MAX_RECIPIENTS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"This matches {len(mailable)} people with email. "
                    f"One send is limited to {_MAX_RECIPIENTS} so a message cannot go to the whole list by mistake. "
                    "Pick specific people or a narrower plan."
                ),
            )
        label = {
            "selected": f"{len(mailable)} selected",
            "all": "Everyone",
            "plan": plan,
        }[audience]
        campaign = {
            "subject": subject,
            "body": body,
            "url": stored_url,
            "audience": audience,
            "audience_label": label,
            "status": "sending",
            "created_by": admin_id,
            "recipient_count": len(mailable),
            "delivered": 0,
            "failed": 0,
            "skipped": skipped,
            "images": images,
        }
        try:
            inserted = sb.table("admin_email_campaigns").insert(campaign).execute()
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)) from e
        if not inserted.data:
            raise HTTPException(status_code=500, detail="Could not save the email")
        row = inserted.data[0]
        threading.Thread(
            target=_deliver,
            args=(sb, row["id"], mailable),
            kwargs={"subject": subject, "body": body, "link": link, "images": images},
            daemon=True,
        ).start()
        return {"ok": True, "email": row}

    @app.post("/admin/emails/preview")
    async def admin_preview_email(req: EmailSendRequest, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        subject = (req.subject or "").strip() or "Subject"
        body = (req.body or "").strip() or "Your message will appear here."
        try:
            from app_notifications_api import _clean_url
        except ImportError:
            from .app_notifications_api import _clean_url
        try:
            stored_url = _clean_url(req.url)
        except HTTPException:
            stored_url = None
        link = _absolute_link(stored_url)
        images = _clean_images(req.images)
        sample = (req.sample_name or "Maria").strip() or "Maria"
        try:
            from email_templates import render_admin_broadcast_email
        except ImportError:
            from .email_templates import render_admin_broadcast_email
        message = render_admin_broadcast_email(
            subject=subject,
            body=body,
            link=link,
            name=sample,
            images=images,
            for_preview=True,
        )
        return {"subject": message.subject, "html": message.html}
