"""Admin composer for one-off emails, using the same audiences as notifications."""

from __future__ import annotations

import json
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


def _deliver(sb, campaign_id: str, users: list[dict[str, Any]], *, subject: str, body: str, link: Optional[str], images: Optional[list[str]] = None, button_label: Optional[str] = None) -> None:
    try:
        _deliver_all(
            sb,
            campaign_id,
            users,
            subject=subject,
            body=body,
            link=link,
            images=images or [],
            button_label=button_label,
        )
    except Exception as exc:
        try:
            sb.table("admin_email_campaigns").update(
                {"status": "failed", "last_error": str(exc)[:400], "sent_at": _now()}
            ).eq("id", campaign_id).execute()
        except Exception:
            pass


def _deliver_all(
    sb,
    campaign_id: str,
    users: list[dict[str, Any]],
    *,
    subject: str,
    body: str,
    link: Optional[str],
    images: Optional[list[str]] = None,
    button_label: Optional[str] = None,
) -> None:
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
            button_label=button_label,
            name=str(user.get("name") or "").strip() or None,
            images=images,
        )
        err = send_email(
            api_key=api_key,
            from_address=from_address,
            to=str(user["email"]),
            message=message,
            kind="campaign",
            campaign_id=str(campaign_id),
            user_id=str(user.get("id") or "") or None,
            to_name=str(user.get("name") or "").strip() or None,
            tags={"campaign": "admin_broadcast"},
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


def _clean_button_label(raw: Optional[str]) -> Optional[str]:
    text = re.sub(r"\s+", " ", (raw or "").strip())
    if not text:
        return None
    # Labels are rendered as text inside the email button — keep them short and plain.
    text = re.sub(r"[<>\"']", "", text)[:48].strip()
    return text or None


class EmailSendRequest(BaseModel):
    subject: str
    body: str
    url: Optional[str] = None
    button_label: Optional[str] = None
    include_button: Optional[bool] = None
    images: list[str] = Field(default_factory=list)
    audience: str = "selected"
    user_ids: list[str] = Field(default_factory=list)
    plan: Optional[str] = None
    sample_name: Optional[str] = None


class EmailDraftRequest(BaseModel):
    brief: str
    tone: str = "warm"
    lang: str = "en"
    existing_subject: Optional[str] = None
    existing_body: Optional[str] = None
    want_button: bool = True


async def _draft_email_with_ai(req: EmailDraftRequest) -> dict[str, Any]:
    m = _main()
    brief = (req.brief or "").strip()
    if len(brief) < 8:
        raise HTTPException(status_code=400, detail="Describe what the email should say (at least a short brief).")
    if len(brief) > 1200:
        raise HTTPException(status_code=400, detail="Brief is too long (max 1200 characters).")

    api_key = (getattr(m, "GROK_API_KEY", "") or "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="AI drafting needs a Grok / xAI API key on the server.")

    tone = (req.tone or "warm").strip().lower()
    if tone not in ("warm", "promo", "reminder", "support"):
        tone = "warm"
    lang = (req.lang or "en").strip().lower()
    if lang not in ("en", "el"):
        lang = "en"
    lang_name = "Greek" if lang == "el" else "English"

    system = (
        "You write short marketing/transactional emails for HeyMaa, a parenting assistant web app. "
        "Return ONLY valid JSON with keys: subject, body, button_label, url_suggestion. "
        "Rules: plain text body (no HTML); you may use **bold**, *italic*, and - bullet lists; "
        "optional {name} placeholder once in the greeting; subject max 90 chars; body 2–8 short paragraphs; "
        "button_label max 32 chars; url_suggestion is a path like /subscription, /app, "
        "/app/auth?gift=CODE (redeemable gift codes from admin Gifts), or empty string; "
        "when the brief mentions a gift code, prefer Claim your gift + /app/auth?gift=THAT_CODE; "
        f"write everything in {lang_name}; tone={tone}; never invent discounts or medical claims."
    )
    user_parts = [f"Brief:\n{brief}"]
    if (req.existing_subject or "").strip():
        user_parts.append(f"Current subject (improve or replace):\n{req.existing_subject.strip()}")
    if (req.existing_body or "").strip():
        user_parts.append(f"Current body (improve or replace):\n{req.existing_body.strip()[:2000]}")
    if not req.want_button:
        user_parts.append("Do not suggest a button: set button_label and url_suggestion to empty strings.")
    user_msg = "\n\n".join(user_parts)

    try:
        raw = await m.call_grok(user_msg, [], system, api_key, history_limit=2, max_tokens=900)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI draft failed: {e}") from e

    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except Exception:
        # Fallback: treat whole reply as body.
        data = {"subject": "HeyMaa update", "body": text[:4000], "button_label": "Open HeyMaa", "url_suggestion": "/app"}

    subject = str(data.get("subject") or "").strip()[:140]
    body = str(data.get("body") or "").strip()[:4000]
    button_label = _clean_button_label(str(data.get("button_label") or ""))
    url_suggestion = str(data.get("url_suggestion") or "").strip()[:300]
    if url_suggestion and not (
        url_suggestion.startswith("/") or url_suggestion.startswith("https://") or url_suggestion.startswith("http://")
    ):
        url_suggestion = ""
    if len(subject) < 2 or len(body) < 2:
        raise HTTPException(status_code=502, detail="AI returned an incomplete draft. Try again with a clearer brief.")
    return {
        "ok": True,
        "subject": subject,
        "body": body,
        "button_label": button_label or "",
        "url_suggestion": url_suggestion,
    }


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
        if req.include_button is False:
            stored_url = None
        link = _absolute_link(stored_url)
        button_label = _clean_button_label(req.button_label)
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
            kwargs={
                "subject": subject,
                "body": body,
                "link": link,
                "images": images,
                "button_label": button_label,
            },
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
        if req.include_button is False:
            stored_url = None
        link = _absolute_link(stored_url)
        button_label = _clean_button_label(req.button_label)
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
            button_label=button_label,
            name=sample,
            images=images,
            for_preview=True,
        )
        return {"subject": message.subject, "html": message.html}

    @app.post("/admin/emails/draft")
    async def admin_draft_email(req: EmailDraftRequest, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        return await _draft_email_with_ai(req)

    @app.get("/admin/emails/reports/transactional")
    async def admin_transactional_email_report(
        days: int = 30,
        since: Optional[str] = None,
        until: Optional[str] = None,
        kind: Optional[str] = None,
        x_token: Optional[str] = Header(None),
    ):
        _require_admin(x_token)
        from datetime import datetime, timedelta, timezone

        if since:
            start = since
        else:
            d = max(1, min(90, int(days or 30)))
            start = (datetime.now(timezone.utc) - timedelta(days=d)).isoformat()
        try:
            from email_analytics import transactional_email_report, transactional_kind_options
        except ImportError:
            from .email_analytics import transactional_email_report, transactional_kind_options
        result = transactional_email_report(
            _main().sb,
            since=start,
            until=until,
            kind=(kind or "").strip() or None,
        )
        if not result.get("ok"):
            raise HTTPException(status_code=503, detail=result.get("error") or "Report unavailable")
        # Always expose filter options even when the period has sparse data.
        if isinstance(result.get("report"), dict) and not result["report"].get("kind_options"):
            result["report"]["kind_options"] = transactional_kind_options()
        return result

    @app.get("/admin/emails/reports/kinds")
    async def admin_email_report_kinds(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        try:
            from email_analytics import transactional_kind_options
        except ImportError:
            from .email_analytics import transactional_kind_options
        return {"kinds": transactional_kind_options()}

    @app.get("/admin/emails/{campaign_id}/report")
    async def admin_email_campaign_report(campaign_id: str, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        try:
            from email_analytics import campaign_email_report
        except ImportError:
            from .email_analytics import campaign_email_report
        result = campaign_email_report(_main().sb, campaign_id)
        if not result.get("ok"):
            raise HTTPException(
                status_code=404 if "not found" in str(result.get("error") or "").lower() else 503,
                detail=result.get("error") or "Report unavailable",
            )
        return result
