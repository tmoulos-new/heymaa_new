"""Admin business insights aggregates (growth, plan mix, MRR model, LLM/cash series)."""
from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Optional

try:
    from .viva_checkout import VIVA_PLANS
    from .plan_entitlements import DEFAULT_PLAN_TX_LIMITS, PLAN_IDS, plan_id_from_name
    from .subscription_cancel import cancel_snapshots_for_users, pending_cancel_count
except ImportError:
    from viva_checkout import VIVA_PLANS
    from plan_entitlements import DEFAULT_PLAN_TX_LIMITS, PLAN_IDS, plan_id_from_name
    from subscription_cancel import cancel_snapshots_for_users, pending_cancel_count


def _parse_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        raw = str(value).strip()
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _day_key(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).date().isoformat()


def monthly_price_eur(plan_id: Optional[str]) -> float:
    """Catalog monthly-equivalent EUR from Viva checkout amounts."""
    pid = (plan_id or "").lower().strip()
    if pid == "annual":
        cents = int((VIVA_PLANS.get("annual") or {}).get("amount") or 19900)
        return round(cents / 100.0 / 12.0, 4)
    if pid in VIVA_PLANS:
        cents = int((VIVA_PLANS[pid] or {}).get("amount") or 0)
        return round(cents / 100.0, 4)
    return 0.0


def period_still_active(
    subscription_status: Optional[str],
    *,
    trial_ends_at: Any = None,
    subscription_ends_at: Any = None,
    now: Optional[datetime] = None,
) -> bool:
    """Mirror access check: active/trial with period end missing or in the future."""
    now = now or datetime.now(timezone.utc)
    status = (subscription_status or "").lower().strip()
    if status == "active":
        end = _parse_dt(subscription_ends_at)
        return end is None or end >= now
    if status == "trial":
        end = _parse_dt(trial_ends_at)
        return end is None or end >= now
    return False


def fill_day_series(
    days: int,
    values_by_day: dict[str, float],
    *,
    end: Optional[date] = None,
) -> list[dict]:
    """Return contiguous day buckets ending at `end` (UTC today by default)."""
    end_d = end or datetime.now(timezone.utc).date()
    start_d = end_d - timedelta(days=max(1, int(days)) - 1)
    out: list[dict] = []
    cur = start_d
    while cur <= end_d:
        key = cur.isoformat()
        out.append({"date": key, "value": float(values_by_day.get(key) or 0)})
        cur += timedelta(days=1)
    return out


def project_month_cost(mtd_cost: float, *, now: Optional[datetime] = None) -> float:
    """Linear projection of month-to-date spend across the calendar month."""
    now = now or datetime.now(timezone.utc)
    day = max(1, now.day)
    days_in_month = monthrange(now.year, now.month)[1]
    return round(float(mtd_cost) / day * days_in_month, 4)


def resolve_user_plan_id(user: dict) -> str:
    raw = user.get("plan_id") or user.get("plan")
    if isinstance(raw, str) and raw.lower().strip() in PLAN_IDS:
        return raw.lower().strip()
    return plan_id_from_name(user.get("plan"), user.get("subscription_status"))


def compute_mrr(
    users: list[dict],
    cancel_by_user: dict[str, dict],
    *,
    now: Optional[datetime] = None,
) -> dict:
    """Projected MRR from catalog prices × active subscriptions."""
    now = now or datetime.now(timezone.utc)
    recognized = 0.0
    renewing = 0.0
    paying_active = 0
    renewing_count = 0
    by_plan: dict[str, dict] = {
        pid: {"users": 0, "recognized_mrr_eur": 0.0, "renewing_mrr_eur": 0.0}
        for pid in ("starter", "premium", "annual")
    }

    for u in users:
        status = (u.get("subscription_status") or "").lower()
        if status != "active":
            continue
        if not period_still_active(
            status,
            subscription_ends_at=u.get("subscription_ends_at"),
            now=now,
        ):
            continue
        pid = resolve_user_plan_id(u)
        price = monthly_price_eur(pid)
        if price <= 0:
            continue
        paying_active += 1
        recognized += price
        if pid in by_plan:
            by_plan[pid]["users"] += 1
            by_plan[pid]["recognized_mrr_eur"] = round(
                by_plan[pid]["recognized_mrr_eur"] + price, 4
            )

        uid = str(u.get("id") or "")
        cancel = cancel_by_user.get(uid) or {}
        cancel_status = (cancel.get("cancel_status") or "").lower()
        if cancel_status in ("pending", "approved"):
            continue
        renewing += price
        renewing_count += 1
        if pid in by_plan:
            by_plan[pid]["renewing_mrr_eur"] = round(
                by_plan[pid]["renewing_mrr_eur"] + price, 4
            )

    return {
        "recognized_mrr_eur": round(recognized, 2),
        "renewing_mrr_eur": round(renewing, 2),
        "paying_active": paying_active,
        "renewing_count": renewing_count,
        "by_plan": by_plan,
        "note": (
            "Modelled from Viva catalog prices × active subscriptions "
            "(annual = €199/12). Not invoiced recurring billing."
        ),
    }


def _paginate(
    sb,
    table: str,
    columns: str,
    *,
    gte_col: Optional[str] = None,
    gte_val: Optional[str] = None,
    eq: Optional[dict] = None,
    order_col: str = "created_at",
    page_size: int = 1000,
    max_rows: int = 20000,
) -> tuple[list, Optional[str]]:
    rows: list = []
    offset = 0
    try:
        while offset < max_rows:
            end = offset + page_size - 1
            q = sb.table(table).select(columns)
            if gte_col and gte_val:
                q = q.gte(gte_col, gte_val)
            if eq:
                for k, v in eq.items():
                    q = q.eq(k, v)
            res = q.order(order_col, desc=False).range(offset, end).execute()
            batch = res.data or []
            rows.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size
        return rows, None
    except Exception as e:
        msg = str(e).lower()
        if "does not exist" in msg or "42p01" in msg:
            return [], f"Table {table} missing"
        return [], str(e)


def build_insights(sb, *, days: int = 30, now: Optional[datetime] = None) -> dict:
    """Aggregate admin insights payload. Soft-fails missing tables."""
    now = now or datetime.now(timezone.utc)
    days = max(7, min(90, int(days or 30)))
    window_start = (now - timedelta(days=days - 1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    notes: list[str] = []

    users: list[dict] = []
    if not sb:
        return _empty_payload(days, now, notes=["Database not configured"])

    try:
        users, err = _paginate(
            sb,
            "users",
            "id,email,plan,plan_id,subscription_status,trial_ends_at,subscription_ends_at,created_at,last_login,role",
            order_col="created_at",
        )
        if err:
            notes.append(err)
    except Exception as e:
        notes.append(f"users: {e}")
        users = []

    user_ids = [str(u["id"]) for u in users if u.get("id")]
    cancel_by_user: dict[str, dict] = {}
    try:
        cancel_by_user = cancel_snapshots_for_users(sb, user_ids) if user_ids else {}
    except Exception as e:
        notes.append(f"cancels: {e}")

    try:
        pending_cancels = pending_cancel_count(sb)
    except Exception:
        pending_cancels = 0

    # Plans catalog (names + limits)
    plans_by_id: dict[str, dict] = {}
    try:
        pres = (
            sb.table("plans")
            .select("id,name,tx_limit,tx_cost_limit_usd,price_label,period_label")
            .execute()
        )
        for p in pres.data or []:
            if p.get("id"):
                plans_by_id[str(p["id"]).lower()] = p
    except Exception:
        try:
            pres = sb.table("plans").select("id,name").execute()
            for p in pres.data or []:
                if p.get("id"):
                    plans_by_id[str(p["id"]).lower()] = p
        except Exception as e:
            notes.append(f"plans: {e}")

    # Growth / mix
    plan_counts: dict[str, int] = defaultdict(int)
    status_counts: dict[str, int] = defaultdict(int)
    new_users_by_day: dict[str, float] = defaultdict(float)
    new_7d = 0
    new_30d = 0
    trial_active = 0
    active_7d = 0
    for u in users:
        pid = resolve_user_plan_id(u)
        plan_counts[pid] += 1
        status = (u.get("subscription_status") or "unknown").lower() or "unknown"
        status_counts[status] += 1

        created = _parse_dt(u.get("created_at"))
        if created and created >= window_start:
            new_users_by_day[_day_key(created)] += 1
        if created and created >= week_start:
            new_7d += 1
        if created and created >= now - timedelta(days=30):
            new_30d += 1

        if status == "trial" and period_still_active(
            "trial", trial_ends_at=u.get("trial_ends_at"), now=now
        ):
            trial_active += 1

        last = _parse_dt(u.get("last_login"))
        if last and last >= week_start:
            active_7d += 1

    mrr = compute_mrr(users, cancel_by_user, now=now)

    users_per_plan = []
    for pid in list(PLAN_IDS) + sorted(k for k in plan_counts if k not in PLAN_IDS):
        count = int(plan_counts.get(pid) or 0)
        if count == 0 and pid not in PLAN_IDS:
            continue
        name = (plans_by_id.get(pid) or {}).get("name") or pid
        users_per_plan.append(
            {
                "plan_id": pid,
                "name": name,
                "users": count,
                "monthly_price_eur": monthly_price_eur(pid),
            }
        )

    # LLM series
    llm_rows, llm_err = _paginate(
        sb,
        "llm_transactions",
        "created_at,cost_usd,ok,user_id",
        gte_col="created_at",
        gte_val=window_start.isoformat(),
        order_col="created_at",
        max_rows=50000,
    )
    if llm_err:
        notes.append(llm_err)

    llm_cost_by_day: dict[str, float] = defaultdict(float)
    llm_calls_by_day: dict[str, float] = defaultdict(float)
    llm_cost_30d = 0.0
    llm_cost_mtd = 0.0
    llm_by_user: dict[str, dict] = defaultdict(lambda: {"tx": 0, "cost": 0.0})
    for row in llm_rows:
        created = _parse_dt(row.get("created_at"))
        if not created:
            continue
        cost = float(row.get("cost_usd") or 0)
        key = _day_key(created)
        llm_cost_by_day[key] += cost
        llm_calls_by_day[key] += 1
        llm_cost_30d += cost
        if created >= month_start:
            llm_cost_mtd += cost
        uid = str(row.get("user_id") or "")
        if uid:
            llm_by_user[uid]["tx"] += 1
            llm_by_user[uid]["cost"] += cost

    projected_llm = project_month_cost(llm_cost_mtd, now=now)

    # Near limits (window spend vs plan cost limit — approximate signal)
    near_limit = 0
    for u in users:
        uid = str(u.get("id") or "")
        usage = llm_by_user.get(uid)
        if not usage:
            continue
        pid = resolve_user_plan_id(u)
        plan_row = plans_by_id.get(pid) or {}
        default_cost = DEFAULT_PLAN_TX_LIMITS.get(pid, DEFAULT_PLAN_TX_LIMITS["trial"])[1]
        cost_limit = plan_row.get("tx_cost_limit_usd")
        try:
            limit = float(cost_limit) if cost_limit is not None else float(default_cost)
        except (TypeError, ValueError):
            limit = float(default_cost)
        if limit > 0 and usage["cost"] >= limit * 0.8:
            near_limit += 1

    # Cash revenue
    order_rows, order_err = _paginate(
        sb,
        "completed_orders",
        "completed_at,amount_cents,plan,status",
        gte_col="completed_at",
        gte_val=window_start.isoformat(),
        order_col="completed_at",
    )
    if order_err:
        notes.append(order_err)

    revenue_by_day: dict[str, float] = defaultdict(float)
    cash_30d = 0.0
    orders_30d = 0
    for row in order_rows:
        status = (row.get("status") or "completed").lower()
        if status and status not in ("completed", "paid", "success"):
            continue
        created = _parse_dt(row.get("completed_at"))
        if not created:
            continue
        amount = float(row.get("amount_cents") or 0) / 100.0
        revenue_by_day[_day_key(created)] += amount
        cash_30d += amount
        orders_30d += 1

    # DAU from user_activity_log
    activity_rows, act_err = _paginate(
        sb,
        "user_activity_log",
        "created_at,user_id",
        gte_col="created_at",
        gte_val=window_start.isoformat(),
        order_col="created_at",
        max_rows=50000,
    )
    if act_err:
        notes.append(act_err)

    dau_sets: dict[str, set] = defaultdict(set)
    for row in activity_rows:
        created = _parse_dt(row.get("created_at"))
        uid = str(row.get("user_id") or "")
        if not created or not uid:
            continue
        dau_sets[_day_key(created)].add(uid)
    dau_by_day = {k: float(len(v)) for k, v in dau_sets.items()}

    # Light consumption from user_data chat/threads/memories counts
    chat_total = 0
    thread_total = 0
    memory_total = 0
    users_with_chat = 0
    try:
        ud_rows, ud_err = _paginate(
            sb,
            "user_data",
            "user_id,key,value",
            order_col="updated_at",
            max_rows=30000,
        )
        if ud_err:
            notes.append(ud_err)
        else:
            for row in ud_rows:
                key = str(row.get("key") or "")
                value = row.get("value")
                n = 0
                if isinstance(value, list):
                    n = len(value)
                elif isinstance(value, dict):
                    # threads/chat sometimes stored as dict of lists
                    if key in ("chat", "threads", "memories"):
                        for v in value.values():
                            if isinstance(v, list):
                                n += len(v)
                            else:
                                n += 1
                        if n == 0:
                            n = len(value)
                if key == "chat" and n:
                    chat_total += n
                    users_with_chat += 1
                elif key == "threads" and n:
                    thread_total += n
                elif key == "memories" and n:
                    memory_total += n
    except Exception as e:
        notes.append(f"user_data: {e}")

    registered = len(users)
    avg_chat = round(chat_total / users_with_chat, 1) if users_with_chat else 0.0

    end_d = now.date()
    return {
        "ok": True,
        "generated_at": now.isoformat(),
        "days": days,
        "notes": notes,
        "kpis": {
            "total_users": registered,
            "new_users_7d": new_7d,
            "new_users_30d": new_30d,
            "paying_active": mrr["paying_active"],
            "trial_active": trial_active,
            "pending_cancels": pending_cancels,
            "active_last_7d": active_7d,
            "recognized_mrr_eur": mrr["recognized_mrr_eur"],
            "renewing_mrr_eur": mrr["renewing_mrr_eur"],
            "cash_revenue_eur": round(cash_30d, 2),
            "orders_count": orders_30d,
            "llm_cost_usd_window": round(llm_cost_30d, 4),
            "llm_cost_usd_mtd": round(llm_cost_mtd, 4),
            "projected_llm_cost_usd_month": projected_llm,
            "users_near_llm_limit": near_limit,
        },
        "mrr": mrr,
        "users_per_plan": users_per_plan,
        "subscription_status": [
            {"status": k, "users": v} for k, v in sorted(status_counts.items(), key=lambda x: -x[1])
        ],
        "series": {
            "new_users": fill_day_series(days, new_users_by_day, end=end_d),
            "llm_cost_usd": fill_day_series(days, llm_cost_by_day, end=end_d),
            "llm_calls": fill_day_series(days, llm_calls_by_day, end=end_d),
            "cash_revenue_eur": fill_day_series(days, revenue_by_day, end=end_d),
            "dau": fill_day_series(days, dau_by_day, end=end_d),
        },
        "behavior": {
            "active_last_7d": active_7d,
            "users_with_chat": users_with_chat,
            "avg_chat_messages": avg_chat,
            "total_chat_messages": chat_total,
            "total_threads": thread_total,
            "total_memories": memory_total,
            "users_near_llm_limit": near_limit,
            "dau_today": int(dau_by_day.get(end_d.isoformat()) or 0),
        },
        "prices_eur": {
            "starter": monthly_price_eur("starter"),
            "premium": monthly_price_eur("premium"),
            "annual_monthly_equiv": monthly_price_eur("annual"),
            "annual_yearly": round(
                int((VIVA_PLANS.get("annual") or {}).get("amount") or 19900) / 100.0, 2
            ),
        },
    }


def _empty_payload(days: int, now: datetime, notes: list[str]) -> dict:
    empty_series = fill_day_series(days, {}, end=now.date())
    return {
        "ok": True,
        "generated_at": now.isoformat(),
        "days": days,
        "notes": notes,
        "kpis": {
            "total_users": 0,
            "new_users_7d": 0,
            "new_users_30d": 0,
            "paying_active": 0,
            "trial_active": 0,
            "pending_cancels": 0,
            "active_last_7d": 0,
            "recognized_mrr_eur": 0,
            "renewing_mrr_eur": 0,
            "cash_revenue_eur": 0,
            "orders_count": 0,
            "llm_cost_usd_window": 0,
            "llm_cost_usd_mtd": 0,
            "projected_llm_cost_usd_month": 0,
            "users_near_llm_limit": 0,
        },
        "mrr": {
            "recognized_mrr_eur": 0,
            "renewing_mrr_eur": 0,
            "paying_active": 0,
            "renewing_count": 0,
            "by_plan": {},
            "note": "",
        },
        "users_per_plan": [],
        "subscription_status": [],
        "series": {
            "new_users": empty_series,
            "llm_cost_usd": empty_series,
            "llm_calls": empty_series,
            "cash_revenue_eur": empty_series,
            "dau": empty_series,
        },
        "behavior": {
            "active_last_7d": 0,
            "users_with_chat": 0,
            "avg_chat_messages": 0,
            "total_chat_messages": 0,
            "total_threads": 0,
            "total_memories": 0,
            "users_near_llm_limit": 0,
            "dau_today": 0,
        },
        "prices_eur": {
            "starter": monthly_price_eur("starter"),
            "premium": monthly_price_eur("premium"),
            "annual_monthly_equiv": monthly_price_eur("annual"),
            "annual_yearly": 199.0,
        },
    }
