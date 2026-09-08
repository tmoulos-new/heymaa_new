"""Persist LLM spend and Replicate prepaid-credit tracking for the admin panel.

HeyMaa uses a dedicated Replicate account. Prepaid remaining is that account's
Billing balance. There is no remaining-credit API, so admins paste the live
number; HeyMaa subtracts chat spend and emails when remaining is low or
Replicate returns 402 (account empty). Gemini RAG embeddings bill Google, not
this balance.
"""
from __future__ import annotations

import contextvars
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Optional

_embed_calls_var: contextvars.ContextVar[int] = contextvars.ContextVar("heymaa_embed_calls", default=0)


def reset_embed_calls() -> None:
    _embed_calls_var.set(0)


def bump_embed_calls() -> None:
    _embed_calls_var.set(int(_embed_calls_var.get() or 0) + 1)


def take_embed_calls() -> int:
    n = int(_embed_calls_var.get() or 0)
    _embed_calls_var.set(0)
    return n

CREDITS_SETTINGS_KEY = "llm_credits"
REPLICATE_BILLING_URL = "https://replicate.com/account/billing"
REPLICATE_TOKENS_URL = "https://replicate.com/account/api-tokens"
REPLICATE_PREPAID_DOCS_URL = "https://replicate.com/docs/topics/billing/prepaid-credit"
REPLICATE_ORGS_URL = "https://replicate.com/organizations/create"
HEYMAA_REPLICATE_ENV = "REPLICATE_HEYMAA_API_TOKEN"

PROVIDERS = ("replicate", "groq", "gemini", "claude", "gemini_embed")

# Fallback USD per successful call when Replicate metrics are missing.
COST_PER_CALL_USD: dict[str, float] = {
    "replicate": 0.002,
    "groq": 0.0002,
    "gemini": 0.002,
    "claude": 0.0025,
    "gemini_embed": 0.00003,
}

# Official Replicate models used by HeyMaa chat.
REPLICATE_MODEL_RATES: dict[str, dict[str, float]] = {
    "google/gemini-2.5-flash": {"per_call": 0.002, "per_predict_second": 0.0},
    "meta/meta-llama-3-70b-instruct": {"per_call": 0.0, "per_predict_second": 0.00115},
}

CREDIT_ERROR_MARKERS = (
    "402",
    "payment required",
    "insufficient credit",
    "insufficient funds",
    "out of credit",
    "no credit",
    "prepaid credit",
    "add credit",
)
RATE_LIMIT_MARKERS = ("429", "rate limit", "quota", "resource exhausted")

ALERT_COOLDOWN_HOURS = {
    "credit_exhausted": 6.0,
    "low_balance": 24.0,
    "daily_budget": 20.0,
    "monthly_budget": 24.0 * 20,
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now(now: Optional[datetime] = None) -> str:
    return (now or utc_now()).isoformat()


def empty_state() -> dict[str, Any]:
    return {
        "replicate_balance_usd": None,
        "synced_at": None,
        "alert_threshold_usd": 5.0,
        "daily_budget_usd": None,
        "monthly_budget_usd": None,
        "spent_since_sync_usd": 0.0,
        "calls_since_sync": 0,
        "calls": {p: 0 for p in PROVIDERS},
        "cost_usd": {p: 0.0 for p in PROVIDERS},
        "models": {},
        "day": "",
        "day_cost_usd": 0.0,
        "day_calls": 0,
        "month": "",
        "month_cost_usd": 0.0,
        "last_error_kind": None,
        "last_error_at": None,
        "last_error_msg": None,
        "alerts": {},
        "replicate_key_fp": "",
        "replicate_key_mask": "",
        "replicate_key_source": "",
        "key_history": [],
        "key_rotated_at": None,
    }


def normalize_state(raw: Any) -> dict[str, Any]:
    base = empty_state()
    if not isinstance(raw, dict):
        return base
    for key in (
        "replicate_balance_usd",
        "synced_at",
        "alert_threshold_usd",
        "daily_budget_usd",
        "monthly_budget_usd",
        "spent_since_sync_usd",
        "calls_since_sync",
        "day",
        "day_cost_usd",
        "day_calls",
        "month",
        "month_cost_usd",
        "last_error_kind",
        "last_error_at",
        "last_error_msg",
        "replicate_key_fp",
        "replicate_key_mask",
        "replicate_key_source",
        "key_rotated_at",
    ):
        if key in raw:
            base[key] = raw[key]
    calls = raw.get("calls") if isinstance(raw.get("calls"), dict) else {}
    cost = raw.get("cost_usd") if isinstance(raw.get("cost_usd"), dict) else {}
    for p in PROVIDERS:
        try:
            base["calls"][p] = int(calls.get(p, 0) or 0)
        except (TypeError, ValueError):
            base["calls"][p] = 0
        try:
            base["cost_usd"][p] = float(cost.get(p, 0) or 0)
        except (TypeError, ValueError):
            base["cost_usd"][p] = 0.0
    models = raw.get("models")
    if isinstance(models, dict):
        base["models"] = models
    alerts = raw.get("alerts")
    if isinstance(alerts, dict):
        base["alerts"] = alerts
    history = raw.get("key_history")
    if isinstance(history, list):
        base["key_history"] = history[-12:]
    try:
        if base["alert_threshold_usd"] is not None:
            base["alert_threshold_usd"] = float(base["alert_threshold_usd"])
    except (TypeError, ValueError):
        base["alert_threshold_usd"] = 5.0
    for money_key in (
        "replicate_balance_usd",
        "daily_budget_usd",
        "monthly_budget_usd",
        "spent_since_sync_usd",
        "day_cost_usd",
        "month_cost_usd",
    ):
        val = base.get(money_key)
        if val is None or val == "":
            if money_key in ("spent_since_sync_usd", "day_cost_usd", "month_cost_usd"):
                base[money_key] = 0.0
            else:
                base[money_key] = None
            continue
        try:
            base[money_key] = float(val)
        except (TypeError, ValueError):
            base[money_key] = None if money_key != "spent_since_sync_usd" else 0.0
    try:
        base["calls_since_sync"] = int(base.get("calls_since_sync") or 0)
        base["day_calls"] = int(base.get("day_calls") or 0)
    except (TypeError, ValueError):
        base["calls_since_sync"] = 0
        base["day_calls"] = 0
    base["replicate_key_fp"] = str(base.get("replicate_key_fp") or "")
    base["replicate_key_mask"] = str(base.get("replicate_key_mask") or "")
    base["replicate_key_source"] = str(base.get("replicate_key_source") or "")
    return base


def parse_state_json(text: str) -> dict[str, Any]:
    try:
        return normalize_state(json.loads(text or "{}"))
    except Exception:
        return empty_state()


def token_fingerprint(token: str) -> str:
    raw = (token or "").strip().encode("utf-8")
    if not raw:
        return ""
    return hashlib.sha256(raw).hexdigest()[:20]


def mask_replicate_token(token: str) -> str:
    t = (token or "").strip()
    if not t:
        return "not set"
    if len(t) <= 8:
        return "••••"
    prefix = t[:4] if t.startswith("r8_") else t[:3]
    return f"{prefix}…{t[-4:]}"


def replicate_token_identity(token: str, source: str = "") -> dict[str, str]:
    t = (token or "").strip()
    return {
        "fingerprint": token_fingerprint(t),
        "mask": mask_replicate_token(t),
        "source": source or ("unset" if not t else "token"),
    }


def bind_state_to_key(
    state: dict[str, Any],
    *,
    fingerprint: str = "",
    mask: str = "",
    source: str = "",
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    """Keep spend/budget on one HeyMaa Replicate token. Rotate = new counter."""
    out = normalize_state(state)
    fp = (fingerprint or "").strip()
    if not fp:
        return out
    prev = str(out.get("replicate_key_fp") or "").strip()
    rotated = bool(prev and prev != fp)
    if rotated:
        history = list(out.get("key_history") or [])
        history.append(
            {
                "fp": prev,
                "mask": out.get("replicate_key_mask") or "",
                "source": out.get("replicate_key_source") or "",
                "spent_usd": out.get("spent_since_sync_usd") or 0,
                "calls": out.get("calls_since_sync") or 0,
                "rotated_at": iso_now(now),
            }
        )
        out["key_history"] = history[-12:]
        out["spent_since_sync_usd"] = 0.0
        out["calls_since_sync"] = 0
        out["key_rotated_at"] = iso_now(now)
    out["replicate_key_fp"] = fp
    out["replicate_key_mask"] = mask or out.get("replicate_key_mask") or ""
    out["replicate_key_source"] = source or out.get("replicate_key_source") or ""
    out["key_rotated"] = rotated
    return out


def classify_llm_error(message: str) -> Optional[str]:
    low = (message or "").lower()
    if any(m in low for m in CREDIT_ERROR_MARKERS):
        return "credit_exhausted"
    if any(m in low for m in RATE_LIMIT_MARKERS):
        return "rate_limit"
    return None


def estimate_replicate_cost(model: str, predict_time_s: Optional[float] = None) -> float:
    rates = REPLICATE_MODEL_RATES.get(model) or {"per_call": COST_PER_CALL_USD["replicate"], "per_predict_second": 0.0}
    cost = float(rates.get("per_call") or 0)
    per_sec = float(rates.get("per_predict_second") or 0)
    if per_sec and predict_time_s:
        cost += max(0.0, float(predict_time_s)) * per_sec
    if cost <= 0:
        cost = COST_PER_CALL_USD["replicate"]
    return round(cost, 6)


def estimate_event_cost(
    provider: str,
    *,
    model: str = "",
    predict_time_s: Optional[float] = None,
    ok: bool = True,
) -> float:
    if not ok:
        return 0.0
    if provider == "replicate":
        return estimate_replicate_cost(model, predict_time_s)
    return float(COST_PER_CALL_USD.get(provider, 0.0))


def _rollover_periods(state: dict[str, Any], now: datetime) -> None:
    day = now.date().isoformat()
    month = now.strftime("%Y-%m")
    if state.get("day") != day:
        state["day"] = day
        state["day_cost_usd"] = 0.0
        state["day_calls"] = 0
    if state.get("month") != month:
        state["month"] = month
        state["month_cost_usd"] = 0.0


def remaining_credit_usd(state: dict[str, Any]) -> Optional[float]:
    bal = state.get("replicate_balance_usd")
    if bal is None:
        return None
    spent = float(state.get("spent_since_sync_usd") or 0)
    return round(float(bal) - spent, 4)


def reload_needed(state: dict[str, Any]) -> bool:
    if state.get("last_error_kind") == "credit_exhausted":
        return True
    remaining = remaining_credit_usd(state)
    threshold = state.get("alert_threshold_usd")
    if remaining is None or threshold is None:
        return False
    return remaining <= float(threshold)


def apply_usage_event(
    state: dict[str, Any],
    *,
    provider: str,
    ok: bool,
    cost_usd: float = 0.0,
    model: str = "",
    error_kind: Optional[str] = None,
    error_msg: str = "",
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    out = normalize_state(state)
    stamp = now or utc_now()
    _rollover_periods(out, stamp)
    provider = provider if provider in PROVIDERS else "replicate"
    cost = max(0.0, float(cost_usd or 0))
    out["calls"][provider] = int(out["calls"].get(provider) or 0) + 1
    out["cost_usd"][provider] = round(float(out["cost_usd"].get(provider) or 0) + cost, 6)
    if ok:
        # Key budget counts only HeyMaa Replicate calls — not Gemini RAG or legacy APIs.
        if provider == "replicate":
            out["spent_since_sync_usd"] = round(float(out.get("spent_since_sync_usd") or 0) + cost, 6)
            out["calls_since_sync"] = int(out.get("calls_since_sync") or 0) + 1
        out["day_cost_usd"] = round(float(out.get("day_cost_usd") or 0) + cost, 6)
        out["day_calls"] = int(out.get("day_calls") or 0) + 1
        out["month_cost_usd"] = round(float(out.get("month_cost_usd") or 0) + cost, 6)
        if model:
            models = out.setdefault("models", {})
            row = models.get(model) if isinstance(models.get(model), dict) else {"calls": 0, "cost_usd": 0.0}
            row["calls"] = int(row.get("calls") or 0) + 1
            row["cost_usd"] = round(float(row.get("cost_usd") or 0) + cost, 6)
            models[model] = row
    if error_kind:
        out["last_error_kind"] = error_kind
        out["last_error_at"] = iso_now(stamp)
        out["last_error_msg"] = (error_msg or "")[:240]
    elif ok and provider == "replicate":
        out["last_error_kind"] = None
        out["last_error_msg"] = None
    return out


def apply_credit_sync(
    state: dict[str, Any],
    *,
    replicate_balance_usd: float,
    alert_threshold_usd: Optional[float] = None,
    daily_budget_usd: Any = "__keep__",
    monthly_budget_usd: Any = "__keep__",
    key_identity: Optional[dict[str, str]] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    out = normalize_state(state)
    ident = key_identity or {}
    out = bind_state_to_key(
        out,
        fingerprint=ident.get("fingerprint") or out.get("replicate_key_fp") or "",
        mask=ident.get("mask") or "",
        source=ident.get("source") or "",
        now=now,
    )
    out["replicate_balance_usd"] = float(replicate_balance_usd)
    out["synced_at"] = iso_now(now)
    out["spent_since_sync_usd"] = 0.0
    out["calls_since_sync"] = 0
    out["key_rotated"] = False
    if alert_threshold_usd is not None:
        out["alert_threshold_usd"] = float(alert_threshold_usd)
    if daily_budget_usd != "__keep__":
        if daily_budget_usd in (None, ""):
            out["daily_budget_usd"] = None
        else:
            out["daily_budget_usd"] = float(daily_budget_usd)
    if monthly_budget_usd != "__keep__":
        if monthly_budget_usd in (None, ""):
            out["monthly_budget_usd"] = None
        else:
            out["monthly_budget_usd"] = float(monthly_budget_usd)
    out["last_error_kind"] = None
    out["last_error_msg"] = None
    return out


def pending_alerts(state: dict[str, Any], now: Optional[datetime] = None) -> list[str]:
    stamp = now or utc_now()
    kinds: list[str] = []
    if state.get("last_error_kind") == "credit_exhausted":
        kinds.append("credit_exhausted")
    remaining = remaining_credit_usd(state)
    threshold = state.get("alert_threshold_usd")
    if remaining is not None and threshold is not None and remaining <= float(threshold):
        kinds.append("low_balance")
    daily = state.get("daily_budget_usd")
    if daily is not None and float(state.get("day_cost_usd") or 0) >= float(daily) > 0:
        kinds.append("daily_budget")
    monthly = state.get("monthly_budget_usd")
    if monthly is not None and float(state.get("month_cost_usd") or 0) >= float(monthly) > 0:
        kinds.append("monthly_budget")
    due: list[str] = []
    alerts = state.get("alerts") if isinstance(state.get("alerts"), dict) else {}
    for kind in kinds:
        last = alerts.get(kind)
        if not last:
            due.append(kind)
            continue
        try:
            last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
        except Exception:
            due.append(kind)
            continue
        hours = (stamp - last_dt).total_seconds() / 3600.0
        if hours >= ALERT_COOLDOWN_HOURS.get(kind, 24.0):
            due.append(kind)
    return due


def mark_alerts_sent(state: dict[str, Any], kinds: list[str], now: Optional[datetime] = None) -> dict[str, Any]:
    out = normalize_state(state)
    alerts = dict(out.get("alerts") or {})
    stamp = iso_now(now)
    for kind in kinds:
        alerts[kind] = stamp
    out["alerts"] = alerts
    return out


def usage_snapshot(state: dict[str, Any], *, provider_mode: str = "replicate") -> dict[str, Any]:
    remaining = remaining_credit_usd(state)
    total_calls = sum(int(state.get("calls", {}).get(p) or 0) for p in PROVIDERS)
    total_cost = round(sum(float(state.get("cost_usd", {}).get(p) or 0) for p in PROVIDERS), 4)
    return {
        "provider_mode": provider_mode,
        "calls": dict(state.get("calls") or {}),
        "cost_usd": {k: round(float(v or 0), 4) for k, v in (state.get("cost_usd") or {}).items()},
        "models": state.get("models") or {},
        "estimated_cost_usd": total_cost,
        "total_calls": total_calls,
        "day_cost_usd": round(float(state.get("day_cost_usd") or 0), 4),
        "day_calls": int(state.get("day_calls") or 0),
        "month_cost_usd": round(float(state.get("month_cost_usd") or 0), 4),
        "replicate_balance_usd": state.get("replicate_balance_usd"),
        "spent_since_sync_usd": round(float(state.get("spent_since_sync_usd") or 0), 4),
        "heymaa_spend_usd": round(float(state.get("spent_since_sync_usd") or 0), 4),
        "remaining_usd": remaining,
        "credit_scope": "heymaa",
        "alert_threshold_usd": state.get("alert_threshold_usd"),
        "daily_budget_usd": state.get("daily_budget_usd"),
        "monthly_budget_usd": state.get("monthly_budget_usd"),
        "synced_at": state.get("synced_at"),
        "reload_needed": reload_needed(state),
        "last_error_kind": state.get("last_error_kind"),
        "last_error_at": state.get("last_error_at"),
        "last_error_msg": state.get("last_error_msg"),
        "replicate_key_mask": state.get("replicate_key_mask") or "",
        "replicate_key_source": state.get("replicate_key_source") or "",
        "key_rotated": bool(state.get("key_rotated")),
        "key_rotated_at": state.get("key_rotated_at"),
        "billing_url": REPLICATE_BILLING_URL,
        "tokens_url": REPLICATE_TOKENS_URL,
        "prepaid_docs_url": REPLICATE_PREPAID_DOCS_URL,
        "orgs_url": REPLICATE_ORGS_URL,
        "note": (
            "This Replicate account is HeyMaa-only. Remaining is the prepaid number last "
            "pasted from Billing, minus HeyMaa chat since then. Gemini RAG embeddings bill "
            "Google, not this pot. Turn on auto reload in Billing so chat does not stop at $0."
        ),
    }


def load_credits_state(sb, key_identity: Optional[dict[str, str]] = None) -> dict[str, Any]:
    if not sb:
        state = empty_state()
    else:
        try:
            res = (
                sb.table("chat_prompt_settings")
                .select("content")
                .eq("key", CREDITS_SETTINGS_KEY)
                .limit(1)
                .execute()
            )
            row = (res.data or [None])[0]
            state = parse_state_json(row.get("content") or "") if row else empty_state()
        except Exception:
            state = empty_state()
    ident = key_identity or {}
    if ident.get("fingerprint"):
        before = str(state.get("replicate_key_fp") or "")
        state = bind_state_to_key(
            state,
            fingerprint=ident.get("fingerprint") or "",
            mask=ident.get("mask") or "",
            source=ident.get("source") or "",
        )
        if state.get("key_rotated") or (ident.get("fingerprint") and before != ident.get("fingerprint")):
            try:
                save_credits_state(sb, state)
            except Exception:
                pass
        else:
            # Keep mask/source current without resetting spend.
            state["replicate_key_mask"] = ident.get("mask") or state.get("replicate_key_mask") or ""
            state["replicate_key_source"] = ident.get("source") or state.get("replicate_key_source") or ""
    return state


def save_credits_state(sb, state: dict[str, Any], *, updated_by: Optional[str] = None) -> None:
    if not sb:
        return
    payload = {
        "key": CREDITS_SETTINGS_KEY,
        "content": json.dumps(normalize_state(state), ensure_ascii=False),
        "updated_at": iso_now(),
    }
    if updated_by:
        payload["updated_by"] = updated_by
    sb.table("chat_prompt_settings").upsert(payload).execute()


def record_llm_event(
    sb,
    *,
    provider: str,
    ok: bool,
    model: str = "",
    predict_time_s: Optional[float] = None,
    error_msg: str = "",
    key_identity: Optional[dict[str, str]] = None,
) -> dict[str, Any]:
    """Load, apply chat/LLM event plus any RAG embed calls from this request."""
    state = load_credits_state(sb, key_identity)
    now = utc_now()
    kind = classify_llm_error(error_msg) if not ok else None
    cost = estimate_event_cost(provider, model=model, predict_time_s=predict_time_s, ok=ok)
    state = apply_usage_event(
        state,
        provider=provider,
        ok=ok,
        cost_usd=cost,
        model=model,
        error_kind=kind,
        error_msg=error_msg,
        now=now,
    )
    n_embed = take_embed_calls()
    embed_cost = COST_PER_CALL_USD["gemini_embed"]
    for _ in range(max(0, n_embed)):
        state = apply_usage_event(
            state,
            provider="gemini_embed",
            ok=True,
            cost_usd=embed_cost,
            now=now,
        )
    try:
        save_credits_state(sb, state)
    except Exception:
        pass
    _maybe_insert_event_row(
        sb,
        provider=provider,
        ok=ok,
        model=model,
        cost_usd=cost,
        predict_time_s=predict_time_s,
        error_kind=kind,
    )
    return state


def _maybe_insert_event_row(
    sb,
    *,
    provider: str,
    ok: bool,
    model: str,
    cost_usd: float,
    predict_time_s: Optional[float],
    error_kind: Optional[str],
) -> None:
    if not sb:
        return
    try:
        row = {
            "provider": provider,
            "model": model or None,
            "ok": ok,
            "est_cost_usd": cost_usd,
            "predict_time_ms": int(predict_time_s * 1000) if predict_time_s else None,
            "error_kind": error_kind,
        }
        sb.table("llm_usage_events").insert(row).execute()
    except Exception:
        pass


def notify_admins_if_needed(
    sb,
    state: dict[str, Any],
    *,
    resend_api_key: str,
    resend_from: str,
    app_url: str,
) -> list[str]:
    """Email all admins for due credit/budget alerts. Returns kinds sent."""
    kinds = pending_alerts(state)
    if not kinds or not resend_api_key or not sb:
        return []
    recipients = list_admin_recipients(sb)
    if not recipients:
        return []
    try:
        try:
            from .email_templates import render_llm_ops_alert_email, send_email
        except ImportError:
            from email_templates import render_llm_ops_alert_email, send_email
    except Exception:
        return []
    remaining = remaining_credit_usd(state)
    admin_url = (app_url or "https://www.heymaa.ai").rstrip("/") + "/admin"
    sent_any = False
    primary = kinds[0]
    for person in recipients:
        try:
            msg = render_llm_ops_alert_email(
                name=person.get("name"),
                kind=primary,
                remaining_usd=remaining,
                spent_usd=float(state.get("spent_since_sync_usd") or 0),
                threshold_usd=state.get("alert_threshold_usd"),
                day_cost_usd=float(state.get("day_cost_usd") or 0),
                last_error=str(state.get("last_error_msg") or ""),
                billing_url=REPLICATE_BILLING_URL,
                admin_url=admin_url,
                key_mask=str(state.get("replicate_key_mask") or ""),
                key_source=str(state.get("replicate_key_source") or ""),
                lang="el",
            )
            err = send_email(
                api_key=resend_api_key,
                from_address=resend_from,
                to=person["email"],
                message=msg,
            )
            if not err:
                sent_any = True
        except Exception:
            continue
    if sent_any:
        state = mark_alerts_sent(state, kinds)
        try:
            save_credits_state(sb, state)
        except Exception:
            pass
        return kinds
    return []


def list_admin_recipients(sb) -> list[dict[str, str]]:
    if not sb:
        return []
    try:
        res = sb.table("users").select("email,name").eq("role", "admin").execute()
        out = []
        for row in res.data or []:
            email = (row.get("email") or "").strip().lower()
            if email and "@" in email:
                out.append({"email": email, "name": row.get("name") or ""})
        return out
    except Exception:
        return []
