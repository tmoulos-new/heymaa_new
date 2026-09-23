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


def is_admin_user(user: dict) -> bool:
    """True when users.role is admin (excluded from growth / plan / MRR stats)."""
    return str(user.get("role") or "").lower().strip() == "admin"


def exclude_admin_users(users: list[dict]) -> tuple[list[dict], set[str]]:
    """Return (non-admin users, admin id set)."""
    admins: set[str] = set()
    kept: list[dict] = []
    for u in users:
        uid = str(u.get("id") or "")
        if is_admin_user(u):
            if uid:
                admins.add(uid)
            continue
        kept.append(u)
    return kept, admins


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
    in_filter: Optional[tuple[str, list]] = None,
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
            if in_filter:
                col, vals = in_filter
                q = q.in_(col, vals)
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


USERS_COLUMNS_FULL = (
    "id,email,plan,plan_id,subscription_status,trial_ends_at,"
    "subscription_ends_at,created_at,last_login,last_active,role"
)
USERS_COLUMNS_NO_ACTIVE = (
    "id,email,plan,plan_id,subscription_status,trial_ends_at,"
    "subscription_ends_at,created_at,last_login,role"
)
USERS_COLUMNS_MIN = "id,email,plan,subscription_status,trial_ends_at,subscription_ends_at,created_at,role"


def _fetch_users(sb) -> tuple[list[dict], Optional[str]]:
    """Load users with column fallback when newer columns are missing."""
    users, err = _paginate(sb, "users", USERS_COLUMNS_FULL, order_col="created_at")
    if not err:
        return users, None
    msg = (err or "").lower()
    # Missing column (last_active / plan_id / last_login) → retry leaner select
    if "column" in msg or "does not exist" in msg or "42703" in msg:
        users2, err2 = _paginate(sb, "users", USERS_COLUMNS_NO_ACTIVE, order_col="created_at")
        if not err2:
            return users2, f"users: used columns without last_active ({err})"
        users3, err3 = _paginate(sb, "users", USERS_COLUMNS_MIN, order_col="created_at")
        if err3:
            return [], err3
        return users3, f"users: used minimal columns ({err})"
    return [], err


def _behavior_from_user_data(sb, notes: list[str], *, exclude_user_ids: Optional[set[str]] = None) -> dict:
    """Count chat/thread/memory rows without downloading huge JSON values."""
    exclude_user_ids = exclude_user_ids or set()
    chat_total = 0
    thread_total = 0
    memory_total = 0
    users_with_chat = 0
    try:
        # Keys only — never select `value` (chat blobs can be MBs and time out the API).
        ud_rows, ud_err = _paginate(
            sb,
            "user_data",
            "user_id,key",
            in_filter=("key", ["chat", "threads", "memories"]),
            order_col="user_id",
            max_rows=20000,
        )
        if ud_err:
            ud_rows, ud_err = _paginate(
                sb,
                "user_data",
                "user_id,key",
                order_col="updated_at",
                max_rows=15000,
            )
            if ud_err:
                # Last resort: no order (some schemas lack updated_at)
                try:
                    res = (
                        sb.table("user_data")
                        .select("user_id,key")
                        .in_("key", ["chat", "threads", "memories"])
                        .limit(5000)
                        .execute()
                    )
                    ud_rows = res.data or []
                    ud_err = None
                except Exception as e2:
                    notes.append(f"user_data: {ud_err or e2}")
                    return {
                        "users_with_chat": 0,
                        "avg_chat_messages": 0.0,
                        "total_chat_messages": 0,
                        "total_threads": 0,
                        "total_memories": 0,
                    }
        chat_users: set[str] = set()
        wanted = {"chat", "threads", "memories"}
        for row in ud_rows:
            key = str(row.get("key") or "")
            if key not in wanted:
                continue
            uid = str(row.get("user_id") or "")
            if uid and uid in exclude_user_ids:
                continue
            if key == "chat" and uid:
                chat_users.add(uid)
                chat_total += 1
            elif key == "threads":
                thread_total += 1
            elif key == "memories":
                memory_total += 1
        users_with_chat = len(chat_users)
    except Exception as e:
        notes.append(f"user_data: {e}")

    return {
        "users_with_chat": users_with_chat,
        "avg_chat_messages": 0.0,
        "total_chat_messages": chat_total,
        "total_threads": thread_total,
        "total_memories": memory_total,
    }


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

    if not sb:
        return _empty_payload(days, now, notes=["Database not configured"])

    users, users_err = _fetch_users(sb)
    if users_err:
        notes.append(users_err)

    users, admin_ids = exclude_admin_users(users)

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

    # Growth / mix — free/trial is a first-class plan (not only "paying")
    plan_counts: dict[str, int] = defaultdict(int)
    status_counts: dict[str, int] = defaultdict(int)
    new_users_by_day: dict[str, float] = defaultdict(float)
    new_7d = 0
    new_30d = 0
    new_today = 0
    trial_active = 0
    free_plan_users = 0
    active_7d = 0
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    for u in users:
        pid = resolve_user_plan_id(u)
        plan_counts[pid] += 1
        if pid == "trial":
            free_plan_users += 1
        status = (u.get("subscription_status") or "unknown").lower() or "unknown"
        status_counts[status] += 1

        created = _parse_dt(u.get("created_at"))
        if created and created >= window_start:
            new_users_by_day[_day_key(created)] += 1
        if created and created >= week_start:
            new_7d += 1
        if created and created >= now - timedelta(days=30):
            new_30d += 1
        if created and created >= today_start:
            new_today += 1

        if status == "trial" and period_still_active(
            "trial", trial_ends_at=u.get("trial_ends_at"), now=now
        ):
            trial_active += 1

        last = (
            _parse_dt(u.get("last_active"))
            or _parse_dt(u.get("last_login"))
            or _parse_dt(u.get("created_at"))
        )
        if last and last >= week_start:
            active_7d += 1

    mrr = compute_mrr(users, cancel_by_user, now=now)

    PLAN_DISPLAY_NAME = {
        "trial": "Free trial",
        "starter": "Starter",
        "premium": "Premium",
        "annual": "Annual",
    }
    users_per_plan = []
    for pid in list(PLAN_IDS) + sorted(k for k in plan_counts if k not in PLAN_IDS):
        count = int(plan_counts.get(pid) or 0)
        if count == 0 and pid not in PLAN_IDS:
            continue
        raw_name = (plans_by_id.get(pid) or {}).get("name") or ""
        name = raw_name if raw_name and raw_name.lower() not in ("trial", "free") else (
            PLAN_DISPLAY_NAME.get(pid) or pid
        )
        if pid == "trial" and not raw_name:
            name = "Free trial"
        users_per_plan.append(
            {
                "plan_id": pid,
                "name": name or PLAN_DISPLAY_NAME.get(pid) or pid,
                "users": count,
                "monthly_price_eur": monthly_price_eur(pid),
                "is_free": pid == "trial" or monthly_price_eur(pid) <= 0,
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
        uid = str(row.get("user_id") or "")
        if uid and uid in admin_ids:
            continue
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

    # DAU from user_activity_log (ids only — no payloads)
    activity_rows, act_err = _paginate(
        sb,
        "user_activity_log",
        "created_at,user_id",
        gte_col="created_at",
        gte_val=window_start.isoformat(),
        order_col="created_at",
        max_rows=40000,
    )
    if act_err:
        notes.append(act_err)

    dau_sets: dict[str, set] = defaultdict(set)
    for row in activity_rows:
        created = _parse_dt(row.get("created_at"))
        uid = str(row.get("user_id") or "")
        if not created or not uid or uid in admin_ids:
            continue
        dau_sets[_day_key(created)].add(uid)
    dau_by_day = {k: float(len(v)) for k, v in dau_sets.items()}

    behavior = _behavior_from_user_data(sb, notes, exclude_user_ids=admin_ids)
    registered = len(users)

    end_d = now.date()
    return {
        "ok": True,
        "generated_at": now.isoformat(),
        "days": days,
        "notes": notes,
        "kpis": {
            "total_users": registered,
            "new_users_today": new_today,
            "new_users_7d": new_7d,
            "new_users_30d": new_30d,
            "free_plan_users": free_plan_users,
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
            "users_with_chat": behavior["users_with_chat"],
            "avg_chat_messages": behavior["avg_chat_messages"],
            "total_chat_messages": behavior["total_chat_messages"],
            "total_threads": behavior["total_threads"],
            "total_memories": behavior["total_memories"],
            "users_near_llm_limit": near_limit,
            "dau_today": int(dau_by_day.get(end_d.isoformat()) or 0),
            "note": "Chat message depth skipped (keys only) so Insights stays fast.",
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
            "new_users_today": 0,
            "new_users_7d": 0,
            "new_users_30d": 0,
            "free_plan_users": 0,
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
