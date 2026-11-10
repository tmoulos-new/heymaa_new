"""Daily administrator + marketing email digest."""
from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

try:
    from .admin_insights import build_insights, period_still_active
    from .email_templates import render_admin_daily_report_email, send_email
    from .llm_usage import list_admin_recipients
    from .marketing_acquisition import analyze_acquisition
except ImportError:
    from admin_insights import build_insights, period_still_active
    from email_templates import render_admin_daily_report_email, send_email
    from llm_usage import list_admin_recipients
    from marketing_acquisition import analyze_acquisition

# Automated / marketing-ish email kinds for open/click rollups
_MARKETING_KINDS = frozenset(
    {
        "drip",
        "campaign",
        "welcome_trial",
        "gift_code",
        "gift_claimed",
        "level_gift",
        "beta_invite",
        "admin_broadcast",
    }
)


def _pct(part: int, whole: int) -> float:
    if whole <= 0:
        return 0.0
    return round(100.0 * part / whole, 2)


def _series_value(series: list[dict], day_iso: str) -> float:
    for row in series or []:
        if str(row.get("date") or "") == day_iso:
            return float(row.get("value") or 0)
    return 0.0


def _series_sum(series: list[dict], days: int = 7) -> float:
    rows = list(series or [])[-max(1, days) :]
    return round(sum(float(r.get("value") or 0) for r in rows), 4)


def _count_query(sb, table: str, *, filters: Optional[list[tuple]] = None) -> int:
    """Best-effort count (prefer PostgREST exact count, fall back to page length)."""
    try:
        q = sb.table(table).select("id", count="exact", head=True)
        for op, col, val in filters or []:
            if op == "eq":
                q = q.eq(col, val)
            elif op == "neq":
                q = q.neq(col, val)
            elif op == "in":
                q = q.in_(col, val)
            elif op == "gte":
                q = q.gte(col, val)
            elif op == "lt":
                q = q.lt(col, val)
            elif op == "lte":
                q = q.lte(col, val)
            elif op == "is":
                q = q.is_(col, val)
        res = q.execute()
        if res.count is not None:
            return int(res.count)
    except Exception:
        pass
    try:
        q = sb.table(table).select("id")
        for op, col, val in filters or []:
            if op == "eq":
                q = q.eq(col, val)
            elif op == "neq":
                q = q.neq(col, val)
            elif op == "in":
                q = q.in_(col, val)
            elif op == "gte":
                q = q.gte(col, val)
            elif op == "lt":
                q = q.lt(col, val)
            elif op == "lte":
                q = q.lte(col, val)
            elif op == "is":
                q = q.is_(col, val)
        res = q.limit(5000).execute()
        return len(res.data or [])
    except Exception:
        return 0


def _paginate_rows(
    sb,
    table: str,
    columns: str,
    *,
    filters: Optional[list[tuple]] = None,
    order_col: Optional[str] = None,
    limit: int = 8000,
) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    page = 500
    while len(rows) < limit:
        try:
            q = sb.table(table).select(columns)
            for op, col, val in filters or []:
                if op == "eq":
                    q = q.eq(col, val)
                elif op == "neq":
                    q = q.neq(col, val)
                elif op == "in":
                    q = q.in_(col, val)
                elif op == "gte":
                    q = q.gte(col, val)
                elif op == "lt":
                    q = q.lt(col, val)
                elif op == "lte":
                    q = q.lte(col, val)
            if order_col:
                q = q.order(order_col, desc=True)
            res = q.range(offset, offset + page - 1).execute()
            batch = list(res.data or [])
            rows.extend(batch)
            if len(batch) < page:
                break
            offset += page
        except Exception:
            break
    return rows[:limit]


def _email_engagement_stats(
    sb,
    *,
    since: Optional[str] = None,
    until: Optional[str] = None,
    kinds: Optional[set[str]] = None,
    limit: int = 6000,
) -> dict[str, Any]:
    """Sent / open / click / bounce / complaint rollup from email_sends + email_events."""
    empty = {
        "sent": 0,
        "delivered": 0,
        "unique_opens": 0,
        "total_opens": 0,
        "open_rate": 0.0,
        "unique_clicks": 0,
        "total_clicks": 0,
        "click_rate": 0.0,
        "bounced": 0,
        "bounce_rate": 0.0,
        "complained": 0,
        "complaint_rate": 0.0,
        "by_kind": [],
    }
    if not sb:
        return empty
    filters: list[tuple] = []
    if since:
        filters.append(("gte", "created_at", since))
    if until:
        filters.append(("lte", "created_at", until))
    try:
        sends = _paginate_rows(
            sb,
            "email_sends",
            "id,resend_id,kind,status,created_at",
            filters=filters or None,
            order_col="created_at",
            limit=limit,
        )
    except Exception:
        return empty

    if kinds is not None:
        sends = [s for s in sends if str(s.get("kind") or "") in kinds]

    if not sends:
        return empty

    by_kind_sent: dict[str, int] = defaultdict(int)
    for s in sends:
        by_kind_sent[str(s.get("kind") or "transactional")] += 1

    resend_ids = [str(s.get("resend_id")) for s in sends if s.get("resend_id")]
    events: list[dict] = []
    for i in range(0, len(resend_ids), 80):
        batch = resend_ids[i : i + 80]
        if not batch:
            continue
        try:
            res = (
                sb.table("email_events")
                .select("resend_id,event_type,occurred_at")
                .in_("resend_id", batch)
                .execute()
            )
            events.extend(res.data or [])
        except Exception:
            pass

    opened_ids = {e["resend_id"] for e in events if e.get("event_type") == "opened"}
    clicked_ids = {e["resend_id"] for e in events if e.get("event_type") == "clicked"}
    bounced_ids = {e["resend_id"] for e in events if e.get("event_type") == "bounced"}
    complained_ids = {e["resend_id"] for e in events if e.get("event_type") == "complained"}
    delivered_ids = {e["resend_id"] for e in events if e.get("event_type") == "delivered"}

    status_delivered = sum(
        1
        for s in sends
        if (s.get("status") or "") in ("sent", "delivered", "opened", "clicked")
    )
    delivered = len(delivered_ids) if delivered_ids else status_delivered
    unique_opens = len(opened_ids)
    unique_clicks = len(clicked_ids)
    bounced = len(bounced_ids) or sum(1 for s in sends if (s.get("status") or "") == "bounced")
    complained = len(complained_ids) or sum(
        1 for s in sends if (s.get("status") or "") == "complained"
    )
    total_opens = sum(1 for e in events if e.get("event_type") == "opened")
    total_clicks = sum(1 for e in events if e.get("event_type") == "clicked")
    sent_n = len(sends)
    denom = delivered or sent_n

    by_kind_opened: dict[str, int] = defaultdict(int)
    by_kind_clicked: dict[str, int] = defaultdict(int)
    for s in sends:
        k = str(s.get("kind") or "transactional")
        rid = s.get("resend_id")
        if rid in opened_ids:
            by_kind_opened[k] += 1
        if rid in clicked_ids:
            by_kind_clicked[k] += 1

    by_kind = [
        {
            "kind": k,
            "sent": n,
            "opened": by_kind_opened.get(k, 0),
            "clicked": by_kind_clicked.get(k, 0),
            "open_rate": _pct(by_kind_opened.get(k, 0), n),
            "click_rate": _pct(by_kind_clicked.get(k, 0), n),
        }
        for k, n in sorted(by_kind_sent.items(), key=lambda kv: -kv[1])
    ]

    return {
        "sent": sent_n,
        "delivered": delivered,
        "unique_opens": unique_opens,
        "total_opens": total_opens,
        "open_rate": _pct(unique_opens, denom),
        "unique_clicks": unique_clicks,
        "total_clicks": total_clicks,
        "click_rate": _pct(unique_clicks, denom),
        "bounced": bounced,
        "bounce_rate": _pct(bounced, sent_n),
        "complained": complained,
        "complaint_rate": _pct(complained, sent_n),
        "by_kind": by_kind,
    }


def _lifetime_cash_eur(sb) -> tuple[float, int]:
    total = 0.0
    orders = 0
    try:
        rows = _paginate_rows(
            sb,
            "completed_orders",
            "amount_cents,status",
            order_col="completed_at",
            limit=10000,
        )
        for row in rows:
            status = (row.get("status") or "completed").lower()
            if status and status not in ("completed", "paid", "success"):
                continue
            total += float(row.get("amount_cents") or 0) / 100.0
            orders += 1
    except Exception:
        pass
    return round(total, 2), orders


def _gather_extras(sb, *, now: datetime, today_start: datetime, day_ago: datetime, week_ago: datetime) -> dict[str, Any]:
    extras: dict[str, Any] = {
        "trials_ending_48h": 0,
        "drip_active_enrollments": 0,
        "drip_completed_enrollments": 0,
        "drip_exited_enrollments": 0,
        "drip_enrolled_today": 0,
        "drip_enrolled_total": 0,
        "drip_sends_24h": 0,
        "drip_email_ok_24h": 0,
        "drip_email_fail_24h": 0,
        "drip_push_ok_24h": 0,
        "drip_sends_total": 0,
        "drip_email_total": 0,
        "drip_push_total": 0,
        "gift_claims_today": 0,
        "gift_claims_total": 0,
        "marketing_consent_on": 0,
        "marketing_consent_off": 0,
        "marketing_opt_ins_today": 0,
        "marketing_unsubscribes_today": 0,
        "push_opt_in": 0,
        "push_devices": 0,
        "support_open": 0,
        "support_pending_admin": 0,
        "email_today": {},
        "email_7d": {},
        "email_all": {},
        "email_drip_today": {},
        "email_drip_all": {},
        "email_campaign_today": {},
        "email_campaign_all": {},
        "cash_lifetime_eur": 0.0,
        "orders_lifetime": 0,
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

    # Conversion drips — snapshot + today + lifetime sends
    try:
        extras["drip_active_enrollments"] = _count_query(
            sb, "conversion_enrollments", filters=[("eq", "status", "active")]
        )
        extras["drip_completed_enrollments"] = _count_query(
            sb, "conversion_enrollments", filters=[("eq", "status", "completed")]
        )
        extras["drip_exited_enrollments"] = _count_query(
            sb, "conversion_enrollments", filters=[("eq", "status", "exited")]
        )
        extras["drip_enrolled_total"] = (
            extras["drip_active_enrollments"]
            + extras["drip_completed_enrollments"]
            + extras["drip_exited_enrollments"]
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

        all_sends = _paginate_rows(
            sb,
            "conversion_drip_sends",
            "id,channel,status",
            order_col="created_at",
            limit=8000,
        )
        extras["drip_sends_total"] = len(all_sends)
        for row in all_sends:
            ch = (row.get("channel") or "").lower()
            if ch == "email":
                extras["drip_email_total"] += 1
            elif ch in ("push", "notification"):
                extras["drip_push_total"] += 1
    except Exception as e:
        extras["notes"].append(f"drips: {e}")

    # Gifts
    try:
        extras["gift_claims_today"] = _count_query(
            sb,
            "gift_claims",
            filters=[("gte", "claimed_at", today_start.isoformat())],
        )
        extras["gift_claims_total"] = _count_query(sb, "gift_claims")
    except Exception as e:
        extras["notes"].append(f"gifts: {e}")

    # Marketing consent + approximate unsubscribes
    try:
        extras["marketing_consent_on"] = _count_query(
            sb, "profiles", filters=[("eq", "consent_marketing", True)]
        )
        extras["marketing_consent_off"] = _count_query(
            sb, "profiles", filters=[("eq", "consent_marketing", False)]
        )
        extras["marketing_opt_ins_today"] = _count_query(
            sb,
            "profiles",
            filters=[
                ("eq", "consent_marketing", True),
                ("gte", "consent_date", today_start.isoformat()),
            ],
        )
        # Approx: opted out and profile touched today (best available without audit log)
        extras["marketing_unsubscribes_today"] = _count_query(
            sb,
            "profiles",
            filters=[
                ("eq", "consent_marketing", False),
                ("gte", "updated_at", today_start.isoformat()),
            ],
        )
        extras["push_opt_in"] = _count_query(
            sb, "profiles", filters=[("eq", "push_alerts_opt_in", True)]
        )
        extras["push_devices"] = _count_query(sb, "push_subscriptions")
    except Exception as e:
        extras["notes"].append(f"consent: {e}")

    # Support
    try:
        extras["support_open"] = _count_query(
            sb, "support_threads", filters=[("eq", "status", "open")]
        )
        extras["support_pending_admin"] = _count_query(
            sb, "support_threads", filters=[("eq", "status", "pending_admin")]
        )
    except Exception as e:
        extras["notes"].append(f"support: {e}")

    # Lifetime cash
    try:
        cash, orders = _lifetime_cash_eur(sb)
        extras["cash_lifetime_eur"] = cash
        extras["orders_lifetime"] = orders
    except Exception as e:
        extras["notes"].append(f"cash_lifetime: {e}")

    # Email engagement windows
    try:
        today_iso = today_start.isoformat()
        week_iso = week_ago.isoformat()
        extras["email_today"] = _email_engagement_stats(sb, since=today_iso)
        extras["email_7d"] = _email_engagement_stats(sb, since=week_iso)
        extras["email_all"] = _email_engagement_stats(sb, since=None, limit=8000)
        extras["email_drip_today"] = _email_engagement_stats(
            sb, since=today_iso, kinds={"drip"}
        )
        extras["email_drip_all"] = _email_engagement_stats(
            sb, since=None, kinds={"drip"}, limit=8000
        )
        extras["email_campaign_today"] = _email_engagement_stats(
            sb, since=today_iso, kinds={"campaign"}
        )
        extras["email_campaign_all"] = _email_engagement_stats(
            sb, since=None, kinds={"campaign"}, limit=8000
        )
        # Marketing subset all-time for manager rollup
        extras["email_marketing_today"] = _email_engagement_stats(
            sb, since=today_iso, kinds=_MARKETING_KINDS
        )
        extras["email_marketing_7d"] = _email_engagement_stats(
            sb, since=week_iso, kinds=_MARKETING_KINDS
        )
        extras["email_marketing_all"] = _email_engagement_stats(
            sb, since=None, kinds=_MARKETING_KINDS, limit=8000
        )
    except Exception as e:
        extras["notes"].append(f"email_stats: {e}")

    return extras


def build_daily_report(sb, *, now: Optional[datetime] = None) -> dict[str, Any]:
    """Assemble a digest with today deltas + cumulative marketing/admin KPIs."""
    now = now or datetime.now(timezone.utc)
    today = now.date()
    today_iso = today.isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    yesterday_iso = (today - timedelta(days=1)).isoformat()

    insights = (
        build_insights(sb, days=30, now=now)
        if sb
        else {
            "ok": False,
            "kpis": {},
            "series": {},
            "behavior": {},
            "users_per_plan": [],
            "notes": ["no db"],
        }
    )
    kpis = insights.get("kpis") or {}
    series = insights.get("series") or {}
    behavior = insights.get("behavior") or {}
    extras = _gather_extras(
        sb, now=now, today_start=today_start, day_ago=day_ago, week_ago=week_ago
    )

    cash_today = _series_value(series.get("cash_revenue_eur") or [], today_iso)
    cash_yesterday = _series_value(series.get("cash_revenue_eur") or [], yesterday_iso)
    llm_today = _series_value(series.get("llm_cost_usd") or [], today_iso)
    llm_calls_today = int(_series_value(series.get("llm_calls") or [], today_iso))
    dau_today = int(
        _series_value(series.get("dau") or [], today_iso) or behavior.get("dau_today") or 0
    )
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
    consent_on = int(extras.get("marketing_consent_on") or 0)
    consent_off = int(extras.get("marketing_consent_off") or 0)
    consent_base = consent_on + consent_off

    return {
        "ok": True,
        "generated_at": now.isoformat(),
        "report_date": today_iso,
        "headline": {
            "new_users_today": int(kpis.get("new_users_today") or 0),
            "new_users_yesterday": new_yesterday,
            "new_users_7d": int(kpis.get("new_users_7d") or 0),
            "new_users_30d": int(kpis.get("new_users_30d") or 0),
            "dau_today": dau_today,
            "active_last_7d": int(kpis.get("active_last_7d") or 0),
            "total_users": int(kpis.get("total_users") or 0),
        },
        "cumulative": {
            "total_users": int(kpis.get("total_users") or 0),
            "paying_active": int(kpis.get("paying_active") or 0),
            "trial_active": int(kpis.get("trial_active") or 0),
            "free_plan_users": int(kpis.get("free_plan_users") or 0),
            "recognized_mrr_eur": float(kpis.get("recognized_mrr_eur") or 0),
            "renewing_mrr_eur": float(kpis.get("renewing_mrr_eur") or 0),
            "cash_lifetime_eur": float(extras.get("cash_lifetime_eur") or 0),
            "orders_lifetime": int(extras.get("orders_lifetime") or 0),
            "users_with_chat": int(behavior.get("users_with_chat") or 0),
            "total_memories": int(behavior.get("total_memories") or 0),
            "gift_claims_total": int(extras.get("gift_claims_total") or 0),
            "drip_enrolled_total": int(extras.get("drip_enrolled_total") or 0),
            "drip_active_enrollments": int(extras.get("drip_active_enrollments") or 0),
            "drip_completed_enrollments": int(extras.get("drip_completed_enrollments") or 0),
            "drip_exited_enrollments": int(extras.get("drip_exited_enrollments") or 0),
            "drip_sends_total": int(extras.get("drip_sends_total") or 0),
            "drip_email_total": int(extras.get("drip_email_total") or 0),
            "drip_push_total": int(extras.get("drip_push_total") or 0),
            "marketing_consent_on": consent_on,
            "marketing_consent_off": consent_off,
            "marketing_consent_rate": _pct(consent_on, consent_base),
            "push_opt_in": int(extras.get("push_opt_in") or 0),
            "push_devices": int(extras.get("push_devices") or 0),
        },
        "revenue": {
            "cash_today_eur": round(cash_today, 2),
            "cash_yesterday_eur": round(cash_yesterday, 2),
            "cash_7d_eur": round(_series_sum(series.get("cash_revenue_eur") or [], 7), 2),
            "cash_30d_eur": float(kpis.get("cash_revenue_eur") or 0),
            "cash_lifetime_eur": float(extras.get("cash_lifetime_eur") or 0),
            "orders_30d": int(kpis.get("orders_count") or 0),
            "orders_lifetime": int(extras.get("orders_lifetime") or 0),
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
            "drip_completed_enrollments": int(extras.get("drip_completed_enrollments") or 0),
            "drip_exited_enrollments": int(extras.get("drip_exited_enrollments") or 0),
            "drip_enrolled_today": int(extras.get("drip_enrolled_today") or 0),
            "drip_enrolled_total": int(extras.get("drip_enrolled_total") or 0),
            "drip_sends_24h": int(extras.get("drip_sends_24h") or 0),
            "drip_email_ok_24h": int(extras.get("drip_email_ok_24h") or 0),
            "drip_email_fail_24h": int(extras.get("drip_email_fail_24h") or 0),
            "drip_push_ok_24h": int(extras.get("drip_push_ok_24h") or 0),
            "drip_sends_total": int(extras.get("drip_sends_total") or 0),
            "drip_email_total": int(extras.get("drip_email_total") or 0),
            "drip_push_total": int(extras.get("drip_push_total") or 0),
            "gift_claims_today": int(extras.get("gift_claims_today") or 0),
            "gift_claims_total": int(extras.get("gift_claims_total") or 0),
            "marketing_consent_total": consent_on,
            "marketing_consent_on": consent_on,
            "marketing_consent_off": consent_off,
            "marketing_consent_rate": _pct(consent_on, consent_base),
            "marketing_opt_ins_today": int(extras.get("marketing_opt_ins_today") or 0),
            "marketing_unsubscribes_today": int(extras.get("marketing_unsubscribes_today") or 0),
            "push_opt_in": int(extras.get("push_opt_in") or 0),
            "push_devices": int(extras.get("push_devices") or 0),
        },
        "email": {
            "today": extras.get("email_today") or {},
            "last_7d": extras.get("email_7d") or {},
            "all_time": extras.get("email_all") or {},
            "marketing_today": extras.get("email_marketing_today") or {},
            "marketing_7d": extras.get("email_marketing_7d") or {},
            "marketing_all": extras.get("email_marketing_all") or {},
            "drip_today": extras.get("email_drip_today") or {},
            "drip_all": extras.get("email_drip_all") or {},
            "campaign_today": extras.get("email_campaign_today") or {},
            "campaign_all": extras.get("email_campaign_all") or {},
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
        "sparks": {
            "new_users_7d": [
                float(r.get("value") or 0)
                for r in (series.get("new_users") or [])[-7:]
            ],
            "dau_7d": [
                float(r.get("value") or 0) for r in (series.get("dau") or [])[-7:]
            ],
            "cash_7d": [
                float(r.get("value") or 0)
                for r in (series.get("cash_revenue_eur") or [])[-7:]
            ],
            "llm_7d": [
                float(r.get("value") or 0)
                for r in (series.get("llm_cost_usd") or [])[-7:]
            ],
        },
        "acquisition": analyze_acquisition(sb, window_start="2026-10-15") if sb else {},
        "notes": notes,
    }


PULSE_RECIPIENTS_KEY = "pulse_report_recipients"
_PULSE_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_pulse_recipients(raw: Any) -> list[dict[str, str]]:
    """Accept list of emails or {email,name} dicts; de-dupe case-insensitively."""
    items: list[Any]
    if isinstance(raw, dict):
        items = raw.get("emails") if isinstance(raw.get("emails"), list) else []
    elif isinstance(raw, list):
        items = raw
    elif isinstance(raw, str):
        items = [p.strip() for p in raw.replace(";", ",").split(",")]
    else:
        items = []
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in items:
        email = ""
        name = ""
        if isinstance(item, str):
            email = item.strip().lower()
        elif isinstance(item, dict):
            email = str(item.get("email") or "").strip().lower()
            name = str(item.get("name") or "").strip()
        if not email or not _PULSE_EMAIL_RE.match(email) or email in seen:
            continue
        seen.add(email)
        out.append({"email": email, "name": name})
    return out


def load_pulse_recipients(sb) -> tuple[list[dict[str, str]], bool]:
    """Return (recipients, configured). configured=True when a DB list was saved."""
    if not sb:
        return [], False
    try:
        res = (
            sb.table("chat_prompt_settings")
            .select("content")
            .eq("key", PULSE_RECIPIENTS_KEY)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return [], False
        content = (rows[0].get("content") or "").strip()
        if not content:
            return [], True
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = content
        return _normalize_pulse_recipients(parsed), True
    except Exception:
        return [], False


def save_pulse_recipients(
    sb,
    emails: Any,
    *,
    updated_by: Optional[str] = None,
) -> list[dict[str, str]]:
    """Persist Pulse recipient list. Empty list is allowed (sends to nobody)."""
    if not sb:
        raise RuntimeError("Database not configured")
    cleaned = _normalize_pulse_recipients(emails)
    payload = {
        "key": PULSE_RECIPIENTS_KEY,
        "content": json.dumps({"emails": cleaned}, ensure_ascii=False),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if updated_by:
        payload["updated_by"] = updated_by
    sb.table("chat_prompt_settings").upsert(payload).execute()
    return cleaned


def resolve_report_recipients(sb) -> list[dict[str, str]]:
    """Prefer admin-panel list, then ADMIN_REPORT_EMAILS env, then role=admin users."""
    db_list, configured = load_pulse_recipients(sb)
    if configured:
        return db_list
    raw = (os.getenv("ADMIN_REPORT_EMAILS") or "").strip()
    if raw:
        out = _normalize_pulse_recipients(raw)
        if out:
            return out
    return list_admin_recipients(sb)


def _resolved_resend_from() -> str:
    """Prefer env; heymaa.ai is verified on the caredirect Resend account."""
    explicit = (os.getenv("RESEND_FROM") or "").strip()
    if explicit:
        return explicit
    return "HeyMaa <info@heymaa.ai>"


def _pulse_already_sent_for_date(sb, report_date: str) -> bool:
    """True if at least one successful Pulse send exists for this report_date (UTC day)."""
    if not sb or not report_date:
        return False
    day = str(report_date).strip()[:10]
    if len(day) < 10:
        return False
    start = f"{day}T00:00:00+00:00"
    end = f"{day}T23:59:59.999999+00:00"
    try:
        # Webhooks often rewrite status from sent → delivered/opened.
        rows = (
            sb.table("email_sends")
            .select("id,status")
            .eq("kind", "admin_daily_report")
            .in_("status", ["sent", "delivered", "opened", "clicked"])
            .gte("created_at", start)
            .lte("created_at", end)
            .limit(1)
            .execute()
        )
        return bool(rows.data)
    except Exception:
        return False


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
    if not force and _pulse_already_sent_for_date(sb, report["report_date"]):
        return {
            "ok": True,
            "skipped": True,
            "reason": "already_sent_today",
            "source": source,
            "report_date": report["report_date"],
        }
    recipients = resolve_report_recipients(sb)
    if not recipients:
        return {
            "ok": False,
            "error": "No Pulse recipients — set them under Admin → Emails → Daily Pulse recipients",
            "report_date": report["report_date"],
        }

    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    from_address = _resolved_resend_from()
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
