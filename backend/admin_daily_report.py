"""Daily administrator email digest (growth, revenue, engagement, drips, ops)."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

try:
    from .admin_insights import build_insights, period_still_active
    from .email_templates import render_admin_daily_report_email, send_email
    from .llm_usage import list_admin_recipients
except ImportError:
    from admin_insights import build_insights, period_still_active
    from email_templates import render_admin_daily_report_email, send_email
    from llm_usage import list_admin_recipients


def _series_value(series: list[dict], day_iso: str) -> float:
    for row in series or []:
        if str(row.get("date") or "") == day_iso:
            return float(row.get("value") or 0)
    return 0.0


def _series_sum(series: list[dict], days: int = 7) -> float:
    rows = list(series or [])[-max(1, days) :]
    return round(sum(float(r.get("value") or 0) for r in rows), 4)


def _count_query(sb, table: str, *, filters: Optional[list[tuple]] = None) -> int:
    """Best-effort count via select id (soft-fail → 0)."""
    try:
        q = sb.table(table).select("id")
        for op, col, val in filters or []:
            if op == "eq":
                q = q.eq(col, val)
            elif op == "in":
                q = q.in_(col, val)
            elif op == "gte":
                q = q.gte(col, val)
            elif op == "lt":
                q = q.lt(col, val)
            elif op == "lte":
                q = q.lte(col, val)
        res = q.limit(5000).execute()
        return len(res.data or [])
    except Exception:
        return 0


def _gather_extras(sb, *, now: datetime, today_start: datetime, day_ago: datetime) -> dict[str, Any]:
    extras: dict[str, Any] = {
        "trials_ending_48h": 0,
        "drip_active_enrollments": 0,
        "drip_enrolled_today": 0,
        "drip_sends_24h": 0,
        "drip_email_ok_24h": 0,
        "drip_email_fail_24h": 0,
        "drip_push_ok_24h": 0,
        "gift_claims_today": 0,
        "marketing_consent_total": 0,
        "support_open": 0,
        "support_pending_admin": 0,
        "notes": [],
    }
    if not sb:
        return extras

    # Trials ending within 48h
    try:
        horizon = (now + timedelta(hours=48)).isoformat()
        res = (
            sb.table("users")
            .select("id,subscription_status,trial_ends_at,role")
            .eq("subscription_status", "trial")
            .lte("trial_ends_at", horizon)
            .gte("trial_ends_at", now.isoformat())
            .limit(2000)
            .execute()
        )
        n = 0
        for u in res.data or []:
            if str(u.get("role") or "").lower() == "admin":
                continue
            if period_still_active("trial", trial_ends_at=u.get("trial_ends_at"), now=now):
                n += 1
        extras["trials_ending_48h"] = n
    except Exception as e:
        extras["notes"].append(f"trials_ending: {e}")

    # Conversion drips
    try:
        extras["drip_active_enrollments"] = _count_query(
            sb, "conversion_enrollments", filters=[("eq", "status", "active")]
        )
        extras["drip_enrolled_today"] = _count_query(
            sb,
            "conversion_enrollments",
            filters=[("gte", "enrolled_at", today_start.isoformat())],
        )
        send_res = (
            sb.table("conversion_drip_sends")
            .select("id,channel,status,created_at")
            .gte("created_at", day_ago.isoformat())
            .limit(5000)
            .execute()
        )
        sends = list(send_res.data or [])
        extras["drip_sends_24h"] = len(sends)
        for row in sends:
            ch = (row.get("channel") or "").lower()
            st = (row.get("status") or "").lower()
            ok = st in ("sent", "ok", "delivered", "success")
            fail = st in ("failed", "error", "bounced")
            if ch == "email":
                if ok:
                    extras["drip_email_ok_24h"] += 1
                elif fail:
                    extras["drip_email_fail_24h"] += 1
            elif ch in ("push", "notification"):
                if ok:
                    extras["drip_push_ok_24h"] += 1
    except Exception as e:
        extras["notes"].append(f"drips: {e}")

    # Gift claims today
    try:
        extras["gift_claims_today"] = _count_query(
            sb,
            "gift_claims",
            filters=[("gte", "claimed_at", today_start.isoformat())],
        )
    except Exception as e:
        extras["notes"].append(f"gifts: {e}")

    # Marketing consent (snapshot)
    try:
        extras["marketing_consent_total"] = _count_query(
            sb, "profiles", filters=[("eq", "consent_marketing", True)]
        )
    except Exception as e:
        extras["notes"].append(f"consent: {e}")

    # Support backlog
    try:
        extras["support_open"] = _count_query(
            sb, "support_threads", filters=[("eq", "status", "open")]
        )
        extras["support_pending_admin"] = _count_query(
            sb, "support_threads", filters=[("eq", "status", "pending_admin")]
        )
    except Exception as e:
        extras["notes"].append(f"support: {e}")

    return extras


def build_daily_report(sb, *, now: Optional[datetime] = None) -> dict[str, Any]:
    """Assemble a single digest payload from insights + day-window extras."""
    now = now or datetime.now(timezone.utc)
    today = now.date()
    today_iso = today.isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_ago = now - timedelta(hours=24)
    yesterday_iso = (today - timedelta(days=1)).isoformat()

    insights = build_insights(sb, days=30, now=now) if sb else {"ok": False, "kpis": {}, "series": {}, "behavior": {}, "users_per_plan": [], "notes": ["no db"]}
    kpis = insights.get("kpis") or {}
    series = insights.get("series") or {}
    behavior = insights.get("behavior") or {}
    extras = _gather_extras(sb, now=now, today_start=today_start, day_ago=day_ago)

    cash_today = _series_value(series.get("cash_revenue_eur") or [], today_iso)
    cash_yesterday = _series_value(series.get("cash_revenue_eur") or [], yesterday_iso)
    llm_today = _series_value(series.get("llm_cost_usd") or [], today_iso)
    llm_calls_today = int(_series_value(series.get("llm_calls") or [], today_iso))
    dau_today = int(_series_value(series.get("dau") or [], today_iso) or behavior.get("dau_today") or 0)
    new_yesterday = int(_series_value(series.get("new_users") or [], yesterday_iso))

    plan_lines = []
    for row in insights.get("users_per_plan") or []:
        if int(row.get("users") or 0) <= 0:
            continue
        plan_lines.append(
            {
                "name": row.get("name") or row.get("plan_id") or "?",
                "users": int(row.get("users") or 0),
                "is_free": bool(row.get("is_free")),
            }
        )

    notes = list(insights.get("notes") or []) + list(extras.get("notes") or [])

    return {
        "ok": True,
        "generated_at": now.isoformat(),
        "report_date": today_iso,
        "headline": {
            "new_users_today": int(kpis.get("new_users_today") or 0),
            "new_users_yesterday": new_yesterday,
            "new_users_7d": int(kpis.get("new_users_7d") or 0),
            "dau_today": dau_today,
            "active_last_7d": int(kpis.get("active_last_7d") or 0),
            "total_users": int(kpis.get("total_users") or 0),
        },
        "revenue": {
            "cash_today_eur": round(cash_today, 2),
            "cash_yesterday_eur": round(cash_yesterday, 2),
            "cash_7d_eur": round(_series_sum(series.get("cash_revenue_eur") or [], 7), 2),
            "cash_30d_eur": float(kpis.get("cash_revenue_eur") or 0),
            "orders_30d": int(kpis.get("orders_count") or 0),
            "paying_active": int(kpis.get("paying_active") or 0),
            "recognized_mrr_eur": float(kpis.get("recognized_mrr_eur") or 0),
            "renewing_mrr_eur": float(kpis.get("renewing_mrr_eur") or 0),
            "pending_cancels": int(kpis.get("pending_cancels") or 0),
        },
        "funnel": {
            "trial_active": int(kpis.get("trial_active") or 0),
            "trials_ending_48h": int(extras.get("trials_ending_48h") or 0),
            "free_plan_users": int(kpis.get("free_plan_users") or 0),
            "users_with_chat": int(behavior.get("users_with_chat") or 0),
            "total_memories": int(behavior.get("total_memories") or 0),
        },
        "messaging": {
            "drip_active_enrollments": int(extras.get("drip_active_enrollments") or 0),
            "drip_enrolled_today": int(extras.get("drip_enrolled_today") or 0),
            "drip_sends_24h": int(extras.get("drip_sends_24h") or 0),
            "drip_email_ok_24h": int(extras.get("drip_email_ok_24h") or 0),
            "drip_email_fail_24h": int(extras.get("drip_email_fail_24h") or 0),
            "drip_push_ok_24h": int(extras.get("drip_push_ok_24h") or 0),
            "gift_claims_today": int(extras.get("gift_claims_today") or 0),
            "marketing_consent_total": int(extras.get("marketing_consent_total") or 0),
        },
        "ops": {
            "llm_cost_today_usd": round(llm_today, 4),
            "llm_calls_today": llm_calls_today,
            "llm_cost_mtd_usd": float(kpis.get("llm_cost_usd_mtd") or 0),
            "projected_llm_month_usd": float(kpis.get("projected_llm_cost_usd_month") or 0),
            "users_near_llm_limit": int(kpis.get("users_near_llm_limit") or 0),
            "support_open": int(extras.get("support_open") or 0),
            "support_pending_admin": int(extras.get("support_pending_admin") or 0),
        },
        "plans": plan_lines,
        "notes": notes,
    }


def resolve_report_recipients(sb) -> list[dict[str, str]]:
    """ADMIN_REPORT_EMAILS (comma-separated) overrides role=admin users."""
    raw = (os.getenv("ADMIN_REPORT_EMAILS") or "").strip()
    if raw:
        out = []
        for part in raw.split(","):
            email = part.strip().lower()
            if email and "@" in email:
                out.append({"email": email, "name": ""})
        if out:
            return out
    return list_admin_recipients(sb)


def send_admin_daily_report(
    sb,
    *,
    now: Optional[datetime] = None,
    force: bool = False,
    source: str = "cron",
) -> dict[str, Any]:
    """Build + email the digest to admins. Soft-fails missing Resend/recipients."""
    disabled = (os.getenv("ADMIN_DAILY_REPORT") or "1").strip().lower() in (
        "0",
        "false",
        "off",
        "no",
    )
    if disabled and not force:
        return {"ok": True, "skipped": True, "reason": "ADMIN_DAILY_REPORT disabled"}

    now = now or datetime.now(timezone.utc)
    report = build_daily_report(sb, now=now)
    recipients = resolve_report_recipients(sb)
    if not recipients:
        return {"ok": False, "error": "No admin recipients", "report_date": report["report_date"]}

    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    from_address = (os.getenv("RESEND_FROM") or "HeyMaa <hello@heymaa.ai>").strip()
    admin_url = (os.getenv("APP_URL") or "https://www.heymaa.ai").rstrip("/") + "/admin/insights"

    sent: list[str] = []
    errors: list[str] = []
    for rec in recipients:
        msg = render_admin_daily_report_email(
            name=rec.get("name") or None,
            report=report,
            admin_url=admin_url,
            lang="el",
        )
        err = send_email(
            api_key=api_key,
            from_address=from_address,
            to=rec["email"],
            message=msg,
            kind="admin_daily_report",
            to_name=rec.get("name") or None,
            tags={"source": source[:40], "report_date": report["report_date"].replace("-", "")},
        )
        if err:
            errors.append(f"{rec['email']}: {err}")
        else:
            sent.append(rec["email"])

    return {
        "ok": not errors,
        "source": source,
        "report_date": report["report_date"],
        "sent": sent,
        "errors": errors,
        "headline": report.get("headline"),
    }
