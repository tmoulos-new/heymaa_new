"""Track Resend sends + webhook events for Moosend-style campaign reports."""

from __future__ import annotations

import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

SENDS_TABLE = "email_sends"
EVENTS_TABLE = "email_events"

# Human labels for admin transactional report filter (kind value → label).
TRANSACTIONAL_KIND_OPTIONS: list[tuple[str, str]] = [
    ("", "All system emails"),
    ("welcome_trial", "Welcome (trial)"),
    ("subscription_welcome", "Subscription welcome"),
    ("subscription_activated", "Subscription activated"),
    ("access_expiry_reminder", "Access expiry reminder"),
    ("level_gift_won", "Level gift won"),
    ("level_gift_activated", "Level gift activated"),
    ("gift_code_claimed", "Gift code claimed"),
    ("password_reset", "Password reset"),
    ("password_changed", "Password changed"),
    ("cancellation_confirmed", "Cancellation confirmed"),
    ("cancel_request_admin", "Cancel request (admin alert)"),
    ("support_received", "Support received (user)"),
    ("support_admin_alert", "Support alert (admin)"),
    ("support_admin_reply", "Support reply (to user)"),
    ("beta_invite", "Beta / tester invite"),
    ("transactional", "Other / untagged"),
]

_EVENT_MAP = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivery_delayed": "delayed",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _table_missing(err: Exception) -> bool:
    msg = str(err).lower()
    return "does not exist" in msg or "42p01" in msg or "pgrst205" in msg


def _sb():
    try:
        import main as m
    except ImportError:
        from . import main as m
    if not getattr(m, "ensure_supabase", lambda: bool(m.sb))():
        return None
    return m.sb


def _clean_email(value: str) -> str:
    return (value or "").strip().lower()[:200]


def _device_bucket(user_agent: Optional[str]) -> str:
    ua = (user_agent or "").lower()
    if not ua:
        return "Unknown"
    if any(x in ua for x in ("iphone", "android", "mobile", "ipad")):
        return "Mobile"
    return "Desktop"


def _client_label(user_agent: Optional[str]) -> str:
    ua = (user_agent or "").lower()
    if "gmail" in ua:
        return "Gmail"
    if "yahoo" in ua:
        return "Yahoo Mail"
    if "outlook" in ua or "microsoft" in ua or "office" in ua:
        return "Microsoft Office"
    if "safari" in ua and "chrome" not in ua:
        return "Safari" + (" Mobile" if "mobile" in ua or "iphone" in ua else "")
    if "chrome" in ua:
        return "Chrome" + (" Mobile" if "mobile" in ua or "android" in ua else "")
    if "firefox" in ua:
        return "Firefox"
    return (user_agent or "Unknown")[:40]


def record_send(
    *,
    resend_id: Optional[str],
    to_email: str,
    subject: str,
    kind: str = "transactional",
    campaign_id: Optional[str] = None,
    user_id: Optional[str] = None,
    to_name: Optional[str] = None,
    tags: Optional[dict[str, str]] = None,
    status: str = "sent",
) -> None:
    sb = _sb()
    if not sb:
        return
    email = _clean_email(to_email)
    if not email:
        return
    row = {
        "resend_id": (resend_id or "").strip() or None,
        "kind": (kind or "transactional").strip()[:60] or "transactional",
        "campaign_id": campaign_id or None,
        "user_id": user_id or None,
        "to_email": email,
        "to_name": (to_name or "").strip()[:120] or None,
        "subject": (subject or "").strip()[:240],
        "tags": tags or {},
        "status": (status or "sent")[:40],
        "created_at": _iso(_now()),
    }
    try:
        sb.table(SENDS_TABLE).insert(row).execute()
    except Exception:
        # Analytics must never break mail delivery.
        pass


def handle_resend_webhook(payload: dict[str, Any]) -> dict[str, Any]:
    sb = _sb()
    if not sb:
        return {"ok": False, "error": "database unavailable"}
    event_type = str(payload.get("type") or "").strip()
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    resend_id = str(data.get("email_id") or data.get("id") or "").strip()
    if not event_type or not resend_id:
        return {"ok": False, "error": "missing type or email_id"}

    to_list = data.get("to") or []
    to_email = ""
    if isinstance(to_list, list) and to_list:
        to_email = _clean_email(str(to_list[0]))
    elif isinstance(to_list, str):
        to_email = _clean_email(to_list)

    click = data.get("click") if isinstance(data.get("click"), dict) else {}
    link = str(click.get("link") or data.get("link") or "").strip()[:800] or None
    user_agent = str(click.get("userAgent") or data.get("user_agent") or "").strip()[:400] or None
    ip = str(click.get("ipAddress") or data.get("ip") or "").strip()[:80] or None
    occurred = str(payload.get("created_at") or data.get("created_at") or _iso(_now()))

    mapped = _EVENT_MAP.get(event_type, event_type.replace("email.", "")[:40])
    row = {
        "resend_id": resend_id,
        "event_type": mapped,
        "to_email": to_email or None,
        "link": link,
        "user_agent": user_agent,
        "ip": ip,
        "payload": payload,
        "occurred_at": occurred,
    }
    try:
        sb.table(EVENTS_TABLE).insert(row).execute()
    except Exception as e:
        if _table_missing(e):
            return {
                "ok": False,
                "error": "Run backend/migrations/email_analytics.sql in Supabase",
            }
        return {"ok": False, "error": str(e)[:200]}

    if mapped in ("delivered", "bounced", "complained"):
        try:
            sb.table(SENDS_TABLE).update({"status": mapped}).eq("resend_id", resend_id).execute()
        except Exception:
            pass
    return {"ok": True, "event": mapped}


def _paginate_sends(sb, *, filters: dict[str, Any], since: Optional[str], until: Optional[str], limit: int = 5000) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    page = 500
    while len(rows) < limit:
        q = sb.table(SENDS_TABLE).select("*").order("created_at", desc=True)
        if since:
            q = q.gte("created_at", since)
        if until:
            q = q.lte("created_at", until)
        for key, val in filters.items():
            if val is None or val == "":
                continue
            q = q.eq(key, val)
        res = q.range(offset, offset + page - 1).execute()
        batch = list(res.data or [])
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return rows[:limit]


def _events_for(sb, resend_ids: list[str]) -> list[dict]:
    out: list[dict] = []
    for i in range(0, len(resend_ids), 80):
        batch = resend_ids[i : i + 80]
        if not batch:
            continue
        try:
            res = (
                sb.table(EVENTS_TABLE)
                .select("resend_id,event_type,to_email,link,user_agent,ip,occurred_at")
                .in_("resend_id", batch)
                .execute()
            )
            out.extend(res.data or [])
        except Exception:
            pass
    return out


def _pct(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round(100.0 * part / whole, 2)


def _build_report(*, sends: list[dict], events: list[dict], title: str, meta: dict[str, Any]) -> dict[str, Any]:
    recipients = len(sends)
    delivered = sum(1 for s in sends if (s.get("status") or "") in ("sent", "delivered", "opened", "clicked"))
    # Prefer webhook-delivered when present
    delivered_ids = {e["resend_id"] for e in events if e.get("event_type") == "delivered"}
    opened_ids = {e["resend_id"] for e in events if e.get("event_type") == "opened"}
    clicked_ids = {e["resend_id"] for e in events if e.get("event_type") == "clicked"}
    bounced_ids = {e["resend_id"] for e in events if e.get("event_type") == "bounced"}
    if delivered_ids:
        delivered = len(delivered_ids)

    total_opens = sum(1 for e in events if e.get("event_type") == "opened")
    total_clicks = sum(1 for e in events if e.get("event_type") == "clicked")
    unique_opens = len(opened_ids)
    unique_clicks = len(clicked_ids)
    bounced = len(bounced_ids)

    opens_by_email: Counter = Counter()
    for e in events:
        if e.get("event_type") != "opened":
            continue
        opens_by_email[_clean_email(str(e.get("to_email") or ""))] += 1
    name_by_email = {
        _clean_email(str(s.get("to_email") or "")): (s.get("to_name") or "")
        for s in sends
    }
    top_recipients = [
        {
            "email": email,
            "name": name_by_email.get(email) or "",
            "total_opens": count,
        }
        for email, count in opens_by_email.most_common(10)
        if email
    ]

    link_counter: Counter = Counter()
    for e in events:
        if e.get("event_type") == "clicked" and e.get("link"):
            link_counter[str(e["link"])] += 1
    top_links = [{"url": url, "clicks": n} for url, n in link_counter.most_common(10)]

    client_counter: Counter = Counter()
    device_counter: Counter = Counter()
    for e in events:
        if e.get("event_type") not in ("opened", "clicked"):
            continue
        ua = e.get("user_agent")
        client_counter[_client_label(ua)] += 1
        device_counter[_device_bucket(ua)] += 1

    day_opens: Counter = Counter()
    day_clicks: Counter = Counter()
    for e in events:
        raw = str(e.get("occurred_at") or "")[:10]
        if not raw:
            continue
        if e.get("event_type") == "opened":
            day_opens[raw] += 1
        elif e.get("event_type") == "clicked":
            day_clicks[raw] += 1
    timeline = []
    for day in sorted(set(day_opens) | set(day_clicks)):
        timeline.append(
            {
                "day": day,
                "unique_opens": day_opens.get(day, 0),
                "unique_clicks": day_clicks.get(day, 0),
            }
        )

    not_opened = max(0, delivered - unique_opens)
    return {
        "title": title,
        "meta": meta,
        "kpis": {
            "recipients": recipients,
            "delivered": delivered,
            "unique_opens": unique_opens,
            "total_opens": total_opens,
            "open_rate": _pct(unique_opens, delivered or recipients),
            "unique_clicks": unique_clicks,
            "total_clicks": total_clicks,
            "click_rate": _pct(unique_clicks, delivered or recipients),
            "bounced": bounced,
            "bounce_rate": _pct(bounced, recipients),
            "unsubscribes": 0,
            "unsubscribe_rate": 0.0,
        },
        "status_mix": {
            "opened": unique_opens,
            "not_opened": not_opened,
            "bounced": bounced,
        },
        "top_recipients": top_recipients,
        "top_links": top_links,
        "clients": [{"name": k, "count": v} for k, v in client_counter.most_common(8)],
        "devices": {
            "desktop": device_counter.get("Desktop", 0),
            "mobile": device_counter.get("Mobile", 0),
            "unknown": device_counter.get("Unknown", 0),
        },
        "timeline": timeline,
        "tracking_note": (
            _webhook_setup_note()
            if total_opens == 0 and total_clicks == 0
            else None
        ),
    }


def campaign_email_report(sb, campaign_id: str) -> dict[str, Any]:
    if not sb:
        return {"ok": False, "error": "Database not configured"}
    try:
        camp = (
            sb.table("admin_email_campaigns")
            .select("*")
            .eq("id", campaign_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        if _table_missing(e):
            return {"ok": False, "error": "Email campaign table missing"}
        return {"ok": False, "error": str(e)[:200]}
    if not camp.data:
        return {"ok": False, "error": "Campaign not found"}
    campaign = camp.data[0]
    try:
        sends = _paginate_sends(sb, filters={"campaign_id": campaign_id}, since=None, until=None)
    except Exception as e:
        if _table_missing(e):
            return {
                "ok": False,
                "error": "Run backend/migrations/email_analytics.sql in Supabase",
            }
        return {"ok": False, "error": str(e)[:200]}
    # Fallback when analytics table empty but campaign counters exist
    if not sends:
        delivered = int(campaign.get("delivered") or 0)
        failed = int(campaign.get("failed") or 0)
        recipients = int(campaign.get("recipient_count") or delivered + failed)
        return {
            "ok": True,
            "report": {
                "title": campaign.get("subject") or "Campaign",
                "meta": {
                    "kind": "campaign",
                    "campaign_id": campaign_id,
                    "audience": campaign.get("audience_label") or campaign.get("audience"),
                    "created_at": campaign.get("created_at"),
                    "status": campaign.get("status"),
                },
                "kpis": {
                    "recipients": recipients,
                    "delivered": delivered,
                    "unique_opens": 0,
                    "total_opens": 0,
                    "open_rate": 0.0,
                    "unique_clicks": 0,
                    "total_clicks": 0,
                    "click_rate": 0.0,
                    "bounced": failed,
                    "bounce_rate": _pct(failed, recipients),
                    "unsubscribes": 0,
                    "unsubscribe_rate": 0.0,
                },
                "status_mix": {"opened": 0, "not_opened": delivered, "bounced": failed},
                "top_recipients": [],
                "top_links": [],
                "clients": [],
                "devices": {"desktop": 0, "mobile": 0, "unknown": 0},
                "timeline": [],
                "tracking_note": (
                    "This campaign has delivery counts only. New sends log per-recipient rows; "
                    + _webhook_setup_note()
                ),
            },
        }
    ids = [str(s.get("resend_id")) for s in sends if s.get("resend_id")]
    events = _events_for(sb, ids)
    report = _build_report(
        sends=sends,
        events=events,
        title=str(campaign.get("subject") or "Campaign"),
        meta={
            "kind": "campaign",
            "campaign_id": campaign_id,
            "audience": campaign.get("audience_label") or campaign.get("audience"),
            "created_at": campaign.get("created_at"),
            "status": campaign.get("status"),
            "from": "HeyMaa <info@heymaa.ai>",
        },
    )
    return {"ok": True, "report": report}


def transactional_kind_options() -> list[dict[str, str]]:
    return [{"id": k, "label": label} for k, label in TRANSACTIONAL_KIND_OPTIONS]


def list_transactional_kinds_in_range(sb, *, since: str, until: Optional[str] = None) -> list[str]:
    """Distinct kinds actually present in the period (excluding campaigns)."""
    if not sb:
        return []
    try:
        sends = _paginate_sends(sb, filters={}, since=since, until=until, limit=5000)
    except Exception:
        return []
    found = sorted(
        {
            str(s.get("kind") or "transactional")
            for s in sends
            if str(s.get("kind") or "") != "campaign"
        }
    )
    return found


def transactional_email_report(
    sb,
    *,
    since: str,
    until: Optional[str] = None,
    kind: Optional[str] = None,
) -> dict[str, Any]:
    if not sb:
        return {"ok": False, "error": "Database not configured"}
    kind_filter = (kind or "").strip()
    try:
        if kind_filter:
            sends = _paginate_sends(
                sb,
                filters={"kind": kind_filter},
                since=since,
                until=until,
            )
            # Never mix campaigns into a transactional kind filter.
            sends = [s for s in sends if str(s.get("kind") or "") != "campaign"]
        else:
            sends = _paginate_sends(
                sb,
                filters={"kind": "transactional"},
                since=since,
                until=until,
            )
            # Also include other non-campaign kinds (welcome, gift, reminder, …)
            extra = _paginate_sends(sb, filters={}, since=since, until=until)
            by_id = {str(s.get("id")): s for s in sends}
            for s in extra:
                k = str(s.get("kind") or "")
                if k and k != "campaign":
                    by_id[str(s.get("id"))] = s
            sends = list(by_id.values())
    except Exception as e:
        if _table_missing(e):
            return {
                "ok": False,
                "error": "Run backend/migrations/email_analytics.sql in Supabase",
            }
        return {"ok": False, "error": str(e)[:200]}

    ids = [str(s.get("resend_id")) for s in sends if s.get("resend_id")]
    events = _events_for(sb, ids)
    label = next((lab for kid, lab in TRANSACTIONAL_KIND_OPTIONS if kid == kind_filter), None)
    title = label if kind_filter and label else "Transactional emails"
    report = _build_report(
        sends=sends,
        events=events,
        title=title,
        meta={
            "kind": "transactional",
            "since": since,
            "until": until,
            "filter_kind": kind_filter or None,
        },
    )
    by_kind: dict[str, dict[str, int]] = defaultdict(lambda: {"sent": 0, "opened": 0, "clicked": 0})
    opened = {e["resend_id"] for e in events if e.get("event_type") == "opened"}
    clicked = {e["resend_id"] for e in events if e.get("event_type") == "clicked"}
    for s in sends:
        k = str(s.get("kind") or "transactional")
        by_kind[k]["sent"] += 1
        rid = s.get("resend_id")
        if rid in opened:
            by_kind[k]["opened"] += 1
        if rid in clicked:
            by_kind[k]["clicked"] += 1
    report["by_kind"] = [
        {"kind": k, **v, "open_rate": _pct(v["opened"], v["sent"])}
        for k, v in sorted(by_kind.items(), key=lambda kv: -kv[1]["sent"])
    ]
    report["kind_options"] = transactional_kind_options()
    report["kinds_in_period"] = list_transactional_kinds_in_range(sb, since=since, until=until)
    return {"ok": True, "report": report}


def notification_report(sb, notification_id: str) -> dict[str, Any]:
    if not sb:
        return {"ok": False, "error": "Database not configured"}
    try:
        note_res = (
            sb.table("app_notifications")
            .select("*")
            .eq("id", notification_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        if _table_missing(e):
            return {"ok": False, "error": "Notification tables missing"}
        return {"ok": False, "error": str(e)[:200]}
    if not note_res.data:
        return {"ok": False, "error": "Notification not found"}
    note = note_res.data[0]
    try:
        rec = (
            sb.table("app_notification_recipients")
            .select("id,user_id,read_at,created_at")
            .eq("notification_id", notification_id)
            .execute()
        )
        recipients = list(rec.data or [])
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}

    user_ids = [str(r.get("user_id")) for r in recipients if r.get("user_id")]
    users_by_id: dict[str, dict] = {}
    for i in range(0, len(user_ids), 80):
        batch = user_ids[i : i + 80]
        if not batch:
            continue
        try:
            ures = (
                sb.table("users")
                .select("id,email,name")
                .in_("id", batch)
                .execute()
            )
            for u in ures.data or []:
                users_by_id[str(u.get("id"))] = u
        except Exception:
            pass

    reads = [r for r in recipients if r.get("read_at")]
    read_count = len(reads)
    recipient_count = len(recipients) or int(note.get("recipient_count") or 0)
    push_attempted = int(note.get("push_attempted") or 0)
    push_delivered = int(note.get("push_delivered") or 0)
    push_failed = int(note.get("push_failed") or 0)

    top_readers = []
    for r in sorted(reads, key=lambda x: str(x.get("read_at") or ""))[:15]:
        u = users_by_id.get(str(r.get("user_id")) or "") or {}
        top_readers.append(
            {
                "email": u.get("email") or "",
                "name": u.get("name") or "",
                "read_at": r.get("read_at"),
            }
        )

    day_reads: Counter = Counter()
    for r in reads:
        day = str(r.get("read_at") or "")[:10]
        if day:
            day_reads[day] += 1
    timeline = [{"day": d, "reads": day_reads[d]} for d in sorted(day_reads)]

    return {
        "ok": True,
        "report": {
            "title": note.get("title") or "Notification",
            "meta": {
                "kind": "notification",
                "notification_id": notification_id,
                "audience": note.get("audience_label") or note.get("audience"),
                "created_at": note.get("created_at"),
                "url": note.get("url"),
                "body": note.get("body"),
            },
            "kpis": {
                "recipients": recipient_count,
                "unique_opens": read_count,
                "total_opens": read_count,
                "open_rate": _pct(read_count, recipient_count),
                "push_attempted": push_attempted,
                "push_delivered": push_delivered,
                "push_failed": push_failed,
                "push_delivery_rate": _pct(push_delivered, push_attempted),
            },
            "status_mix": {
                "opened": read_count,
                "not_opened": max(0, recipient_count - read_count),
                "push_failed": push_failed,
            },
            "top_recipients": top_readers,
            "timeline": timeline,
            "tracking_note": (
                "Opens = in-app bell reads. Push counts are lock-screen / browser push delivery."
            ),
        },
    }


def notifications_period_report(sb, *, since: str, until: Optional[str] = None) -> dict[str, Any]:
    """Aggregate in-app notification campaigns for a date range."""
    if not sb:
        return {"ok": False, "error": "Database not configured"}
    try:
        req = (
            sb.table("app_notifications")
            .select(
                "id,title,body,audience,audience_label,recipient_count,"
                "push_attempted,push_delivered,push_failed,created_at"
            )
            .gte("created_at", since)
            .order("created_at", desc=True)
            .limit(200)
        )
        if until:
            req = req.lte("created_at", until)
        notes_res = req.execute()
        notes = list(notes_res.data or [])
    except Exception as e:
        if _table_missing(e):
            return {"ok": False, "error": "Notification tables missing"}
        return {"ok": False, "error": str(e)[:200]}

    note_ids = [str(n.get("id")) for n in notes if n.get("id")]
    reads_by_note: dict[str, int] = defaultdict(int)
    top_readers_raw: list[dict] = []
    day_reads: Counter = Counter()

    for i in range(0, len(note_ids), 40):
        batch = note_ids[i : i + 40]
        if not batch:
            continue
        try:
            rec = (
                sb.table("app_notification_recipients")
                .select("notification_id,user_id,read_at")
                .in_("notification_id", batch)
                .execute()
            )
        except Exception as e:
            return {"ok": False, "error": str(e)[:200]}
        for row in rec.data or []:
            nid = str(row.get("notification_id") or "")
            if row.get("read_at"):
                reads_by_note[nid] += 1
                day = str(row.get("read_at") or "")[:10]
                if day:
                    day_reads[day] += 1
                top_readers_raw.append(row)

    user_ids = [str(r.get("user_id")) for r in top_readers_raw if r.get("user_id")]
    users_by_id: dict[str, dict] = {}
    for i in range(0, len(user_ids), 80):
        batch = user_ids[i : i + 80]
        if not batch:
            continue
        try:
            ures = sb.table("users").select("id,email,name").in_("id", batch).execute()
            for u in ures.data or []:
                users_by_id[str(u.get("id"))] = u
        except Exception:
            pass

    reader_counts: Counter = Counter()
    reader_meta: dict[str, dict] = {}
    for r in top_readers_raw:
        uid = str(r.get("user_id") or "")
        if not uid:
            continue
        reader_counts[uid] += 1
        u = users_by_id.get(uid) or {}
        reader_meta[uid] = {
            "email": u.get("email") or "",
            "name": u.get("name") or "",
            "total_opens": reader_counts[uid],
        }
    top_recipients = sorted(reader_meta.values(), key=lambda x: -int(x.get("total_opens") or 0))[:15]

    campaigns = []
    total_recipients = 0
    total_reads = 0
    push_attempted = 0
    push_delivered = 0
    push_failed = 0
    for note in notes:
        nid = str(note.get("id") or "")
        recipients = int(note.get("recipient_count") or 0)
        reads = int(reads_by_note.get(nid) or 0)
        total_recipients += recipients
        total_reads += reads
        pa = int(note.get("push_attempted") or 0)
        pd = int(note.get("push_delivered") or 0)
        pf = int(note.get("push_failed") or 0)
        push_attempted += pa
        push_delivered += pd
        push_failed += pf
        campaigns.append(
            {
                "id": nid,
                "title": note.get("title") or "Notification",
                "recipients": recipients,
                "reads": reads,
                "open_rate": _pct(reads, recipients),
                "push_attempted": pa,
                "push_delivered": pd,
                "created_at": note.get("created_at"),
            }
        )

    timeline = [{"day": d, "reads": day_reads[d]} for d in sorted(day_reads)]

    return {
        "ok": True,
        "report": {
            "title": "Notifications overview",
            "meta": {
                "kind": "notifications_period",
                "since": since,
                "until": until,
                "campaign_count": len(notes),
            },
            "kpis": {
                "campaigns": len(notes),
                "recipients": total_recipients,
                "unique_opens": total_reads,
                "total_opens": total_reads,
                "open_rate": _pct(total_reads, total_recipients),
                "push_attempted": push_attempted,
                "push_delivered": push_delivered,
                "push_failed": push_failed,
                "push_delivery_rate": _pct(push_delivered, push_attempted),
            },
            "status_mix": {
                "opened": total_reads,
                "not_opened": max(0, total_recipients - total_reads),
                "push_failed": push_failed,
            },
            "campaigns": campaigns,
            "top_recipients": top_recipients,
            "timeline": timeline,
            "tracking_note": (
                "Period totals across in-app notifications. Reads = bell opens; push = lock-screen delivery."
            ),
        },
    }


def _webhook_endpoint_url() -> str:
    base = (os.getenv("APP_URL") or "https://www.heymaa.ai").rstrip("/")
    return f"{base}/webhooks/resend"


def _webhook_setup_note() -> str:
    return (
        "Opens/clicks need Resend webhooks. In Resend → Webhooks → Add Webhook, set URL "
        f"{_webhook_endpoint_url()} and enable email.delivered, email.opened, email.clicked, "
        "email.bounced (and email.complained). Copy the whsec_ signing secret into Vercel as "
        "RESEND_WEBHOOK_SECRET. Also run backend/migrations/email_analytics.sql in Supabase if needed."
    )


def webhook_secret_ok(header_secret: Optional[str], query_secret: Optional[str]) -> bool:
    """Legacy check (header / ?secret=). Prefer verify_resend_webhook for production."""
    expected = (os.getenv("RESEND_WEBHOOK_SECRET") or "").strip()
    if not expected:
        # Allow ingest when secret not configured (local / first setup).
        return True
    got = (header_secret or query_secret or "").strip()
    return bool(got) and got == expected


def verify_resend_webhook(
    *,
    raw_body: str,
    svix_id: Optional[str],
    svix_timestamp: Optional[str],
    svix_signature: Optional[str],
    header_secret: Optional[str] = None,
    query_secret: Optional[str] = None,
) -> bool:
    """Accept Resend (Svix) signatures, or legacy x-resend-secret / ?secret= for manual tests."""
    expected = (os.getenv("RESEND_WEBHOOK_SECRET") or "").strip()
    if not expected:
        return True

    if svix_id and svix_timestamp and svix_signature:
        try:
            import resend as _resend

            _resend.Webhooks.verify(
                {
                    "payload": raw_body or "",
                    "headers": {
                        "id": svix_id,
                        "timestamp": svix_timestamp,
                        "signature": svix_signature,
                    },
                    "webhook_secret": expected,
                }
            )
            return True
        except Exception:
            return False

    return webhook_secret_ok(header_secret, query_secret)
