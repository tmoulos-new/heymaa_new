"""Admin marketing notifications: in-app inbox plus Web Push."""

from __future__ import annotations

import re
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

_MISSING = (
    "Notification tables are missing. Run backend/migrations/app_notifications.sql "
    "in the Supabase SQL editor, then try again."
)


def _main():
    # Vercel loads this file as backend.app_notifications_api, so `import main` misses.
    try:
        from . import main as m
    except ImportError:
        import main as m
    return m


def _wants_admin_spa(request: Request) -> bool:
    accept = (request.headers.get("accept") or "").lower()
    return "text/html" in accept and "application/json" not in accept


def _admin_spa_response():
    import os

    m = _main()
    path = m._admin_index_path()
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Admin UI not built")
    return FileResponse(path, media_type="text/html")


def _require_user(token: Optional[str]) -> str:
    m = _main()
    if not m.ensure_supabase():
        raise HTTPException(status_code=503, detail="Database not configured")
    auth = m.resolve_auth(token or "", context="app")
    if auth.get("kind") != "user" or not auth.get("user_id"):
        raise HTTPException(status_code=401, detail="Sign in to HeyMaa to use notifications.")
    return str(auth["user_id"])


def _require_admin(token: Optional[str]) -> str:
    m = _main()
    if not m.ensure_supabase():
        raise HTTPException(status_code=503, detail="Database not configured")
    return str(m.verify_admin(token))


def _missing_table(exc: Exception) -> bool:
    text = str(exc).lower()
    return "app_notification" in text or "push_subscription" in text or "42p01" in text or "does not exist" in text


def _clean_url(url: Optional[str]) -> Optional[str]:
    raw = (url or "").strip()
    if not raw:
        return None
    if raw.startswith("/") and not raw.startswith("//"):
        return raw[:300]
    if raw.startswith("https://") or raw.startswith("http://localhost") or raw.startswith("http://127.0.0.1"):
        return raw[:500]
    raise HTTPException(status_code=400, detail="Link must be a path like /subscription or an https URL.")


def _page_users(sb, *, audience: str, user_ids: list[str], plan: str) -> list[dict[str, Any]]:
    if audience == "selected":
        ids = [u for u in user_ids if u][:200]
        if not ids:
            return []
        res = (
            sb.table("users")
            .select("id,email,name,plan,plan_id,subscription_status")
            .in_("id", ids)
            .execute()
        )
        return list(res.data or [])

    rows: list[dict[str, Any]] = []
    offset = 0
    page = 500
    while len(rows) < 2000:
        q = sb.table("users").select("id,email,name,plan,plan_id,subscription_status")
        if audience == "plan" and plan:
            safe = re.sub(r"[^a-zA-Z0-9_\-]", "", plan)[:40]
            if not safe:
                return []
            q = q.or_(
                f"plan.eq.{safe},plan_id.eq.{safe},subscription_status.eq.{safe}"
            )
        res = q.range(offset, offset + page - 1).execute()
        batch = list(res.data or [])
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page

    if audience == "no_push":
        subscribed = _user_ids_with_push(sb)
        rows = [u for u in rows if str(u.get("id") or "") not in subscribed]
    return rows


def _user_ids_with_push(sb) -> set[str]:
    ids: set[str] = set()
    offset = 0
    page = 1000
    while True:
        try:
            res = (
                sb.table("push_subscriptions")
                .select("user_id")
                .range(offset, offset + page - 1)
                .execute()
            )
        except Exception:
            break
        batch = list(res.data or [])
        for row in batch:
            uid = str(row.get("user_id") or "")
            if uid:
                ids.add(uid)
        if len(batch) < page:
            break
        offset += page
    return ids


def _count_table(sb, table: str, *, eq: Optional[tuple[str, Any]] = None) -> int:
    try:
        q = sb.table(table).select("id", count="exact", head=True)
        if eq:
            q = q.eq(eq[0], eq[1])
        res = q.execute()
        return int(res.count or 0)
    except Exception:
        return 0


def push_adoption_report(sb) -> dict[str, Any]:
    """How many accounts opted in / have an active Web Push device."""
    if not sb:
        return {"ok": False, "error": "Database not configured"}

    total_users = _count_table(sb, "users")
    devices = _count_table(sb, "push_subscriptions")
    with_device_ids = _user_ids_with_push(sb)
    with_device = len(with_device_ids)

    soft_opt_in = 0
    try:
        soft_opt_in = _count_table(sb, "profiles", eq=("push_alerts_opt_in", True))
    except Exception:
        soft_opt_in = 0

    soft_without_device = 0
    try:
        # Approximate: soft-opt profiles that have no push row.
        offset = 0
        page = 500
        while True:
            res = (
                sb.table("profiles")
                .select("id")
                .eq("push_alerts_opt_in", True)
                .range(offset, offset + page - 1)
                .execute()
            )
            batch = list(res.data or [])
            for row in batch:
                uid = str(row.get("id") or "")
                if uid and uid not in with_device_ids:
                    soft_without_device += 1
            if len(batch) < page:
                break
            offset += page
    except Exception:
        soft_without_device = max(0, soft_opt_in - with_device)

    without_device = max(0, total_users - with_device)
    never_engaged = max(0, without_device - soft_without_device)

    def _pct(part: int, whole: int) -> float:
        if whole <= 0:
            return 0.0
        return round(100.0 * part / whole, 2)

    return {
        "ok": True,
        "report": {
            "title": "Web Push adoption",
            "meta": {"kind": "push_adoption"},
            "kpis": {
                "recipients": total_users,
                "campaigns": with_device,
                "unique_opens": soft_opt_in,
                "total_opens": soft_without_device,
                "open_rate": _pct(with_device, total_users),
                "push_attempted": without_device,
                "push_delivered": devices,
                "push_failed": never_engaged,
                "push_delivery_rate": _pct(soft_opt_in, total_users),
            },
            "status_mix": {
                "opened": with_device,
                "not_opened": soft_without_device,
                "push_failed": never_engaged,
            },
            "tracking_note": (
                "Activated = users with at least one browser/device subscription. "
                "Interested = soft opt-in at signup/settings without a live device yet. "
                "Not activated = no push subscription (in-app bell still works)."
            ),
            "campaigns": [
                {
                    "id": "activated",
                    "title": "Activated (has device)",
                    "recipients": with_device,
                    "reads": with_device,
                    "open_rate": _pct(with_device, total_users),
                    "push_delivered": devices,
                    "push_attempted": devices,
                },
                {
                    "id": "interested",
                    "title": "Interested, no device yet",
                    "recipients": soft_without_device,
                    "reads": 0,
                    "open_rate": _pct(soft_without_device, total_users),
                    "push_delivered": 0,
                    "push_attempted": 0,
                },
                {
                    "id": "not_activated",
                    "title": "Not activated",
                    "recipients": without_device,
                    "reads": 0,
                    "open_rate": _pct(without_device, total_users),
                    "push_delivered": 0,
                    "push_attempted": 0,
                },
            ],
        },
    }


def _subscriptions_for(sb, user_ids: list[str]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for i in range(0, len(user_ids), 80):
        batch = user_ids[i : i + 80]
        res = (
            sb.table("push_subscriptions")
            .select("id,user_id,endpoint,p256dh,auth")
            .in_("user_id", batch)
            .execute()
        )
        found.extend(res.data or [])
    return found


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: dict[str, str] = Field(default_factory=dict)
    expirationTime: Optional[float] = None


class NotificationReadRequest(BaseModel):
    ids: list[str] = Field(default_factory=list)


class NotificationSendRequest(BaseModel):
    title: str
    body: str
    url: Optional[str] = None
    audience: str = "selected"
    user_ids: list[str] = Field(default_factory=list)
    plan: Optional[str] = None


class PushPreferenceRequest(BaseModel):
    opted_in: bool = False


class NotificationDraftRequest(BaseModel):
    brief: str
    tone: str = "warm"
    lang: str = "en"
    existing_title: Optional[str] = None
    existing_body: Optional[str] = None
    want_url: bool = True


def _clean_notif_url(raw: str) -> str:
    url = (raw or "").strip()[:300]
    if not url:
        return ""
    if url.startswith("/") or url.startswith("https://") or url.startswith("http://"):
        return url
    return ""


async def _draft_notification_with_ai(req: NotificationDraftRequest) -> dict[str, Any]:
    import json

    m = _main()
    brief = (req.brief or "").strip()
    if len(brief) < 8:
        raise HTTPException(status_code=400, detail="Describe what the notification should say (at least a short brief).")
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
        "You write short in-app / push notifications for HeyMaa, a parenting assistant web app. "
        "Return ONLY valid JSON with keys: title, body, url_suggestion. "
        "Rules: plain text only (no HTML, no markdown); title max 80 chars (ideally under 50); "
        "body max 180 chars for lock-screen + in-app bell (1–2 short sentences); "
        "url_suggestion is a path like /subscription, /app, /app?gift=CODE, or empty string; "
        "when the brief mentions a gift code, prefer /app?gift=THAT_CODE; "
        f"write everything in {lang_name}; tone={tone}; never invent discounts or medical claims."
    )
    user_parts = [f"Brief:\n{brief}"]
    if (req.existing_title or "").strip():
        user_parts.append(f"Current title (improve or replace):\n{req.existing_title.strip()}")
    if (req.existing_body or "").strip():
        user_parts.append(f"Current body (improve or replace):\n{req.existing_body.strip()[:800]}")
    if not req.want_url:
        user_parts.append("Do not suggest a link: set url_suggestion to an empty string.")
    user_msg = "\n\n".join(user_parts)

    try:
        raw = await m.call_grok(user_msg, [], system, api_key, history_limit=2, max_tokens=500)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI draft failed: {e}") from e

    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except Exception:
        data = {"title": "HeyMaa update", "body": text[:500], "url_suggestion": "/app"}

    title = str(data.get("title") or "").strip()[:120]
    body = str(data.get("body") or "").strip()[:500]
    url_suggestion = _clean_notif_url(str(data.get("url_suggestion") or ""))
    if len(title) < 2 or len(body) < 2:
        raise HTTPException(status_code=502, detail="AI returned an incomplete draft. Try again with a clearer brief.")
    return {
        "ok": True,
        "title": title,
        "body": body,
        "url_suggestion": url_suggestion,
    }


def register_notification_routes(app: FastAPI) -> None:
    @app.get("/me/push/public-key")
    async def me_push_public_key(x_token: Optional[str] = Header(None)):
        _require_user(x_token)
        from push_delivery import vapid_status

        status = vapid_status()
        if not status.get("configured"):
            raise HTTPException(status_code=503, detail=status.get("error") or "Push is not configured")
        return {"public_key": status["public_key"]}

    @app.post("/me/push/preference")
    async def me_push_preference(req: PushPreferenceRequest, x_token: Optional[str] = Header(None)):
        """Soft opt-in for alerts. Does not replace the browser permission prompt."""
        user_id = _require_user(x_token)
        sb = _main().sb
        opted = bool(req.opted_in)
        now = _main()._now_iso() if hasattr(_main(), "_now_iso") else None
        fields = {"push_alerts_opt_in": opted}
        if now is not None:
            fields["push_alerts_opt_in_at"] = now if opted else None
        try:
            auth = {"kind": "user", "user_id": user_id, "token": x_token}
            _main().profile_upsert(auth, fields)
        except Exception as e:
            # Column may be missing until migration runs — soft-fail.
            if "push_alerts_opt_in" in str(e).lower() or "42703" in str(e):
                return {"ok": True, "saved": False, "opted_in": opted}
            raise HTTPException(status_code=500, detail=str(e)[:200]) from e
        if not opted:
            try:
                sb.table("push_subscriptions").delete().eq("user_id", user_id).execute()
            except Exception:
                pass
        return {"ok": True, "saved": True, "opted_in": opted}

    @app.post("/me/push/subscribe")
    async def me_push_subscribe(req: PushSubscribeRequest, x_token: Optional[str] = Header(None)):
        user_id = _require_user(x_token)
        sb = _main().sb
        endpoint = (req.endpoint or "").strip()
        p256dh = (req.keys or {}).get("p256dh") or ""
        auth = (req.keys or {}).get("auth") or ""
        if not endpoint.startswith("https://") or not p256dh or not auth:
            raise HTTPException(status_code=400, detail="Invalid push subscription")
        row = {
            "user_id": user_id,
            "endpoint": endpoint[:2000],
            "p256dh": p256dh[:300],
            "auth": auth[:300],
            "updated_at": _main()._now_iso() if hasattr(_main(), "_now_iso") else None,
        }
        row = {k: v for k, v in row.items() if v is not None}
        try:
            existing = (
                sb.table("push_subscriptions").select("id").eq("endpoint", endpoint).limit(1).execute()
            )
            if existing.data:
                sb.table("push_subscriptions").update(
                    {"user_id": user_id, "p256dh": row["p256dh"], "auth": row["auth"]}
                ).eq("id", existing.data[0]["id"]).execute()
            else:
                sb.table("push_subscriptions").insert(row).execute()
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)) from e
        # Successful subscribe implies durable opt-in.
        try:
            now = _main()._now_iso() if hasattr(_main(), "_now_iso") else None
            fields = {"push_alerts_opt_in": True}
            if now:
                fields["push_alerts_opt_in_at"] = now
            _main().profile_upsert({"kind": "user", "user_id": user_id, "token": x_token}, fields)
        except Exception:
            pass
        return {"ok": True}

    @app.delete("/me/push/subscribe")
    async def me_push_unsubscribe(x_token: Optional[str] = Header(None)):
        user_id = _require_user(x_token)
        sb = _main().sb
        try:
            sb.table("push_subscriptions").delete().eq("user_id", user_id).execute()
        except Exception as e:
            if _missing_table(e):
                return {"ok": True}
            raise HTTPException(status_code=500, detail=str(e)) from e
        try:
            _main().profile_upsert(
                {"kind": "user", "user_id": user_id, "token": x_token},
                {"push_alerts_opt_in": False, "push_alerts_opt_in_at": None},
            )
        except Exception:
            pass
        return {"ok": True}

    @app.get("/me/notifications")
    async def me_notifications(x_token: Optional[str] = Header(None)):
        user_id = _require_user(x_token)
        sb = _main().sb
        try:
            rec = (
                sb.table("app_notification_recipients")
                .select("id,notification_id,read_at,created_at")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(40)
                .execute()
            )
        except Exception as e:
            if _missing_table(e):
                return {"notifications": [], "unread": 0}
            raise HTTPException(status_code=500, detail=str(e)) from e
        rows = list(rec.data or [])
        if not rows:
            return {"notifications": [], "unread": 0}
        ids = list({r["notification_id"] for r in rows if r.get("notification_id")})
        notes = (
            sb.table("app_notifications")
            .select("id,title,body,url,created_at")
            .in_("id", ids)
            .execute()
        )
        by_id = {n["id"]: n for n in (notes.data or [])}
        items = []
        unread = 0
        for row in rows:
            note = by_id.get(row.get("notification_id")) or {}
            if not note:
                continue
            is_read = bool(row.get("read_at"))
            if not is_read:
                unread += 1
            items.append(
                {
                    "id": row["id"],
                    "title": note.get("title") or "",
                    "body": note.get("body") or "",
                    "url": note.get("url"),
                    "created_at": note.get("created_at") or row.get("created_at"),
                    "read": is_read,
                }
            )
        return {"notifications": items, "unread": unread}

    @app.post("/me/notifications/read")
    async def me_notifications_read(req: NotificationReadRequest, x_token: Optional[str] = Header(None)):
        user_id = _require_user(x_token)
        sb = _main().sb
        ids = [i for i in req.ids if i][:40]
        if not ids:
            return {"ok": True}
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).isoformat()
        try:
            (
                sb.table("app_notification_recipients")
                .update({"read_at": now})
                .eq("user_id", user_id)
                .in_("id", ids)
                .execute()
            )
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)) from e
        return {"ok": True}

    @app.get("/admin/notifications/status")
    async def admin_notification_status(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        from push_delivery import vapid_status

        status = vapid_status()
        devices = 0
        try:
            res = sb.table("push_subscriptions").select("id", count="exact", head=True).execute()
            devices = int(res.count or 0)
        except Exception:
            devices = 0
        status["devices"] = devices
        return status

    @app.post("/admin/notifications/draft")
    async def admin_draft_notification(req: NotificationDraftRequest, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        return await _draft_notification_with_ai(req)

    @app.get("/admin/notifications/users")
    async def admin_notification_users(q: str = "", x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        query = (q or "").strip().replace("%", "").replace(",", " ")[:80]
        try:
            req = sb.table("users").select("id,email,name,plan,subscription_status").limit(40)
            if query:
                safe = query.replace("'", "")
                req = req.or_(f"email.ilike.%{safe}%,name.ilike.%{safe}%")
            res = req.execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        return {"users": res.data or []}

    @app.get("/admin/notifications")
    async def admin_list_notifications(
        request: Request,
        x_token: Optional[str] = Header(None),
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 10,
    ):
        if _wants_admin_spa(request):
            return _admin_spa_response()
        _require_admin(x_token)
        sb = _main().sb
        lim = max(1, min(100, int(limit or 10)))
        start = (from_date or "").strip() or None
        end = (to_date or "").strip() or None
        if start and len(start) == 10:
            start = f"{start}T00:00:00+00:00"
        if end and len(end) == 10:
            end = f"{end}T23:59:59.999999+00:00"
        try:
            q = (
                sb.table("app_notifications")
                .select("*")
                .order("created_at", desc=True)
            )
            if start:
                q = q.gte("created_at", start)
            if end:
                q = q.lte("created_at", end)
            res = q.limit(lim).execute()
        except Exception as e:
            if _missing_table(e):
                return {"notifications": [], "error": _MISSING}
            raise HTTPException(status_code=500, detail=str(e)) from e
        notes = list(res.data or [])
        ids = [n["id"] for n in notes if n.get("id")]
        read_by: dict[str, int] = {}
        if ids:
            try:
                rec = (
                    sb.table("app_notification_recipients")
                    .select("notification_id,read_at")
                    .in_("notification_id", ids)
                    .execute()
                )
                for row in rec.data or []:
                    if row.get("read_at"):
                        nid = row.get("notification_id")
                        read_by[nid] = read_by.get(nid, 0) + 1
            except Exception:
                pass
        for note in notes:
            note["read_count"] = read_by.get(note.get("id"), 0)
        return {
            "notifications": notes,
            "limit": lim,
            "from_date": (from_date or "").strip() or None,
            "to_date": (to_date or "").strip() or None,
        }

    @app.delete("/admin/notifications/{notification_id}")
    async def admin_delete_notification(notification_id: str, x_token: Optional[str] = Header(None)):
        admin_id = _require_admin(x_token)
        sb = _main().sb
        nid = (notification_id or "").strip()
        if not nid:
            raise HTTPException(status_code=400, detail="notification_id required")
        try:
            existing = (
                sb.table("app_notifications")
                .select("id,title")
                .eq("id", nid)
                .limit(1)
                .execute()
            )
            if not existing.data:
                raise HTTPException(status_code=404, detail="Notification not found")
            row = existing.data[0]
            try:
                sb.table("app_notification_recipients").delete().eq("notification_id", nid).execute()
            except Exception:
                pass
            sb.table("app_notifications").delete().eq("id", nid).execute()
            try:
                _main()._log_activity(
                    admin_id,
                    "delete",
                    "app_notification",
                    nid,
                    value_before={"title": row.get("title")},
                )
            except Exception:
                pass
        except HTTPException:
            raise
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)) from e
        return {"ok": True, "id": nid}

    @app.post("/admin/notifications")
    async def admin_send_notification(
        req: NotificationSendRequest,
        x_token: Optional[str] = Header(None),
    ):
        admin_id = _require_admin(x_token)
        sb = _main().sb
        title = (req.title or "").strip()
        body = (req.body or "").strip()
        if len(title) < 2 or len(title) > 120:
            raise HTTPException(status_code=400, detail="Title must be 2–120 characters.")
        if len(body) < 2 or len(body) > 500:
            raise HTTPException(status_code=400, detail="Message must be 2–500 characters.")
        url = _clean_url(req.url)
        audience = (req.audience or "selected").strip().lower()
        if audience not in ("selected", "all", "plan", "no_push"):
            raise HTTPException(
                status_code=400,
                detail="audience must be selected, all, plan, or no_push",
            )
        plan = (req.plan or "").strip()
        if audience == "plan" and not plan:
            raise HTTPException(status_code=400, detail="Choose a plan or status to target.")
        try:
            users = _page_users(sb, audience=audience, user_ids=req.user_ids, plan=plan)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        users = [u for u in users if u.get("id")]
        if not users:
            raise HTTPException(status_code=400, detail="No matching users to notify.")

        label = {
            "selected": f"{len(users)} selected",
            "all": "Everyone",
            "plan": plan,
            "no_push": f"Without push ({len(users)})",
        }[audience]
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).isoformat()
        campaign = {
            "title": title,
            "body": body,
            "url": url,
            "audience": audience,
            "audience_label": label,
            "status": "sent",
            "created_by": admin_id,
            "sent_at": now,
            "recipient_count": len(users),
            "push_attempted": 0,
            "push_delivered": 0,
            "push_failed": 0,
        }
        try:
            inserted = sb.table("app_notifications").insert(campaign).execute()
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)) from e
        if not inserted.data:
            raise HTTPException(status_code=500, detail="Could not save the notification")
        note = inserted.data[0]
        note_id = note["id"]
        recipients = [
            {"notification_id": note_id, "user_id": u["id"]}
            for u in users
        ]
        try:
            for i in range(0, len(recipients), 200):
                sb.table("app_notification_recipients").insert(recipients[i : i + 200]).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Saved the message but could not assign users: {e}") from e

        attempted = delivered = failed = 0
        last_error = None
        try:
            subs = _subscriptions_for(sb, [u["id"] for u in users])
        except Exception as e:
            subs = []
            last_error = str(e)[:400]
        if subs:
            from pywebpush import WebPushException
            from push_delivery import send_web_push

            for sub in subs:
                attempted += 1
                try:
                    send_web_push(
                        sub,
                        title=title,
                        body=body,
                        url=url,
                        tag=str(note_id),
                    )
                    delivered += 1
                except WebPushException as e:
                    failed += 1
                    last_error = str(e)[:400]
                    status = getattr(getattr(e, "response", None), "status_code", None)
                    if status in (404, 410):
                        try:
                            sb.table("push_subscriptions").delete().eq("id", sub["id"]).execute()
                        except Exception:
                            pass
                except Exception as e:
                    failed += 1
                    last_error = str(e)[:400]
        try:
            sb.table("app_notifications").update(
                {
                    "push_attempted": attempted,
                    "push_delivered": delivered,
                    "push_failed": failed,
                    "last_error": last_error,
                }
            ).eq("id", note_id).execute()
        except Exception:
            pass
        note.update(
            {
                "push_attempted": attempted,
                "push_delivered": delivered,
                "push_failed": failed,
                "last_error": last_error,
                "read_count": 0,
            }
        )
        return {"ok": True, "notification": note}

    @app.get("/admin/notifications/reports/push-adoption")
    async def admin_push_adoption_report(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        result = push_adoption_report(_main().sb)
        if not result.get("ok"):
            raise HTTPException(status_code=503, detail=result.get("error") or "Report unavailable")
        return result

    @app.get("/admin/notifications/reports/overview")
    async def admin_notifications_overview_report(
        days: int = 30,
        since: Optional[str] = None,
        until: Optional[str] = None,
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
            from email_analytics import notifications_period_report
        except ImportError:
            from .email_analytics import notifications_period_report
        result = notifications_period_report(_main().sb, since=start, until=until)
        if not result.get("ok"):
            raise HTTPException(status_code=503, detail=result.get("error") or "Report unavailable")
        return result

    @app.get("/admin/notifications/{notification_id}/report")
    async def admin_notification_report(notification_id: str, x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        try:
            from email_analytics import notification_report
        except ImportError:
            from .email_analytics import notification_report
        result = notification_report(_main().sb, notification_id)
        if not result.get("ok"):
            raise HTTPException(
                status_code=404 if "not found" in str(result.get("error") or "").lower() else 503,
                detail=result.get("error") or "Report unavailable",
            )
        return result
