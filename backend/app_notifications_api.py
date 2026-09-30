"""Admin marketing notifications: in-app inbox plus Web Push."""

from __future__ import annotations

import re
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

_MISSING = (
    "Notification tables are missing. Run backend/migrations/app_notifications.sql "
    "in the Supabase SQL editor, then try again."
)


def _main():
    import main as m

    return m


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
    return rows


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


def register_notification_routes(app: FastAPI) -> None:
    @app.get("/me/push/public-key")
    async def me_push_public_key(x_token: Optional[str] = Header(None)):
        _require_user(x_token)
        from push_delivery import vapid_status

        status = vapid_status()
        if not status.get("configured"):
            raise HTTPException(status_code=503, detail=status.get("error") or "Push is not configured")
        return {"public_key": status["public_key"]}

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

    @app.get("/admin/notifications/users")
    async def admin_notification_users(q: str = "", x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        query = (q or "").strip().replace("%", "").replace(",", " ")[:80]
        try:
            req = sb.table("users").select("id,email,name,plan,subscription_status").limit(25)
            if query:
                safe = query.replace("'", "")
                req = req.or_(f"email.ilike.%{safe}%,name.ilike.%{safe}%")
            res = req.execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        return {"users": res.data or []}

    @app.get("/admin/notifications")
    async def admin_list_notifications(x_token: Optional[str] = Header(None)):
        _require_admin(x_token)
        sb = _main().sb
        try:
            res = (
                sb.table("app_notifications")
                .select("*")
                .order("created_at", desc=True)
                .limit(40)
                .execute()
            )
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
        return {"notifications": notes}

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
        if audience not in ("selected", "all", "plan"):
            raise HTTPException(status_code=400, detail="audience must be selected, all, or plan")
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
