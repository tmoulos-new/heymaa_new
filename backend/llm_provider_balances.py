"""Live provider headroom / spend signals for the admin Overview.

None of Grok (xAI), Gemini (API key), or Claude (standard key) expose a prepaid
dollar balance. This module returns the best live signals each vendor allows:

- Grok (xAI): online check via models list (no rate-limit headers like Groq)
- Claude: month-to-date cost via Admin Cost API when ANTHROPIC_ADMIN_API_KEY is set;
  otherwise only key-present / online status
- Gemini: no balance API — report HeyMaa-tracked spend and a billing console link
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

import requests

XAI_BILLING_URL = "https://console.x.ai/"
XAI_USAGE_URL = "https://console.x.ai/"
CLAUDE_BILLING_URL = "https://console.anthropic.com/settings/billing"
CLAUDE_USAGE_URL = "https://console.anthropic.com/settings/usage"
GEMINI_BILLING_URL = "https://aistudio.google.com/billing"
GEMINI_USAGE_URL = "https://aistudio.google.com/usage"


def _fnum(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _header(headers: Any, *names: str) -> Optional[str]:
    if headers is None:
        return None
    for name in names:
        try:
            val = headers.get(name)
        except Exception:
            val = None
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    # Case-insensitive fallback
    try:
        lower = {str(k).lower(): v for k, v in headers.items()}
    except Exception:
        return None
    for name in names:
        val = lower.get(name.lower())
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    return None


def probe_groq_limits(api_key: str) -> dict[str, Any]:
    """Probe primary chat provider (xAI Grok). Provider id remains `groq` for logs."""
    out: dict[str, Any] = {
        "provider": "groq",
        "ok": False,
        "label": "Grok",
        "kind": "online",
        "billing_url": XAI_BILLING_URL,
        "usage_url": XAI_USAGE_URL,
        "note": "xAI Grok does not expose prepaid $ balance via API — showing online status.",
    }
    key = (api_key or "").strip()
    if not key:
        out["msg"] = "no key"
        return out
    try:
        r = requests.get(
            "https://api.x.ai/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=12,
        )
        rem_req = _fnum(_header(r.headers, "x-ratelimit-remaining-requests"))
        lim_req = _fnum(_header(r.headers, "x-ratelimit-limit-requests"))
        rem_tok = _fnum(_header(r.headers, "x-ratelimit-remaining-tokens"))
        lim_tok = _fnum(_header(r.headers, "x-ratelimit-limit-tokens"))
        reset_req = _header(r.headers, "x-ratelimit-reset-requests")
        reset_tok = _header(r.headers, "x-ratelimit-reset-tokens")
        if not r.ok:
            out["msg"] = (r.text or f"HTTP {r.status_code}")[:160]
            return out
        out["ok"] = True
        out["remaining_requests"] = rem_req
        out["limit_requests"] = lim_req
        out["remaining_tokens"] = rem_tok
        out["limit_tokens"] = lim_tok
        out["reset_requests"] = reset_req
        out["reset_tokens"] = reset_tok
        if rem_req is not None and lim_req:
            out["requests_pct_left"] = round(100.0 * rem_req / lim_req, 1)
        if rem_tok is not None and lim_tok:
            out["tokens_pct_left"] = round(100.0 * rem_tok / lim_tok, 1)
        parts = []
        if rem_req is not None and lim_req is not None:
            parts.append(f"{int(rem_req):,}/{int(lim_req):,} req left")
        if rem_tok is not None and lim_tok is not None:
            parts.append(f"{int(rem_tok):,}/{int(lim_tok):,} tok left")
        models = r.json().get("data") if isinstance(r.json(), dict) else None
        n_models = len(models) if isinstance(models, list) else None
        if parts:
            out["summary"] = " · ".join(parts)
            out["msg"] = out["summary"]
            out["kind"] = "rate_limits"
        elif n_models:
            out["summary"] = f"online · {n_models} models"
            out["msg"] = out["summary"]
        else:
            out["summary"] = "online"
            out["msg"] = "online"
        return out
    except Exception as e:
        out["msg"] = str(e)[:160]
        return out


def _anthropic_admin_key(chat_key: str = "") -> tuple[str, str]:
    """Return (key, source). Prefer dedicated admin key."""
    import os

    for name in ("ANTHROPIC_ADMIN_API_KEY", "ANTHROPIC_ADMIN_KEY"):
        val = (os.getenv(name) or "").strip()
        if val:
            return val, f"env:{name}"
    chat = (chat_key or "").strip()
    if chat.startswith("sk-ant-admin"):
        return chat, "chat_key_admin"
    return "", ""


def probe_claude_spend(api_key: str) -> dict[str, Any]:
    out: dict[str, Any] = {
        "provider": "claude",
        "ok": False,
        "label": "Claude",
        "kind": "spend",
        "billing_url": CLAUDE_BILLING_URL,
        "usage_url": CLAUDE_USAGE_URL,
        "note": (
            "Claude prepaid $ balance is not on the chat API. "
            "Set ANTHROPIC_ADMIN_API_KEY for month-to-date cost from the Admin Cost API."
        ),
    }
    chat_key = (api_key or "").strip()
    admin_key, admin_src = _anthropic_admin_key(chat_key)
    if not chat_key and not admin_key:
        out["msg"] = "no key"
        out["summary"] = "no key"
        return out

    if chat_key and not chat_key.startswith("sk-ant-admin"):
        out["chat_key_configured"] = True
        out["ok"] = True

    if not admin_key:
        out["summary"] = (
            "chat key set · open Console Billing for prepaid $ "
            "(or set ANTHROPIC_ADMIN_API_KEY for month spend)"
        )
        out["msg"] = out["summary"]
        return out

    # Admin Cost API — month to date
    try:
        now = datetime.now(timezone.utc)
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        ending = now.replace(microsecond=0)
        # ending_at exclusive — bump one day for safety
        from datetime import timedelta

        ending_excl = (ending + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        r = requests.get(
            "https://api.anthropic.com/v1/organizations/cost_report",
            headers={
                "x-api-key": admin_key,
                "anthropic-version": "2023-06-01",
            },
            params={
                "starting_at": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "ending_at": ending_excl.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "bucket_width": "1d",
            },
            timeout=20,
        )
        if not r.ok:
            out["ok"] = bool(out.get("chat_key_configured"))
            out["admin_error"] = (r.text or f"HTTP {r.status_code}")[:160]
            out["summary"] = (
                f"admin cost failed · {out['admin_error']}"
                if not out["ok"]
                else "chat key set · admin cost unavailable"
            )
            out["msg"] = out["summary"]
            out["admin_key_source"] = admin_src
            return out

        payload = r.json() if r.content else {}
        buckets = payload.get("data") or []
        cents_total = 0.0
        for bucket in buckets:
            for item in bucket.get("results") or []:
                amt = _fnum(item.get("amount"))
                if amt is not None:
                    cents_total += amt
        # Anthropic docs: amount is in lowest units (cents) as decimal string
        mtd_usd = round(cents_total / 100.0, 4)
        out["ok"] = True
        out["kind"] = "spend"
        out["month_cost_usd"] = mtd_usd
        out["admin_key_source"] = admin_src
        out["summary"] = f"${mtd_usd:.2f} spent this month (Admin Cost API)"
        out["msg"] = out["summary"]
        out["note"] = (
            "Month-to-date Claude Platform cost from Admin API. "
            "Prepaid remaining $ still only in Console Billing."
        )
        return out
    except Exception as e:
        out["ok"] = bool(out.get("chat_key_configured"))
        out["msg"] = str(e)[:160]
        out["summary"] = out["msg"]
        return out


def probe_gemini_headroom(api_key: str, tracked_cost_usd: float = 0.0) -> dict[str, Any]:
    out: dict[str, Any] = {
        "provider": "gemini",
        "ok": False,
        "label": "Gemini",
        "kind": "tracked",
        "billing_url": GEMINI_BILLING_URL,
        "usage_url": GEMINI_USAGE_URL,
        "tracked_cost_usd": round(float(tracked_cost_usd or 0), 4),
        "note": (
            "Gemini API keys do not expose prepaid balance. "
            "Check Prepay credits in AI Studio Billing; figure below is HeyMaa-tracked spend."
        ),
    }
    key = (api_key or "").strip()
    if not key:
        out["msg"] = "no key"
        out["summary"] = "no key"
        return out
    try:
        r = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
            timeout=12,
        )
        if not r.ok:
            out["msg"] = (r.text or f"HTTP {r.status_code}")[:160]
            out["summary"] = out["msg"]
            return out
        out["ok"] = True
        tracked = round(float(tracked_cost_usd or 0), 4)
        out["summary"] = (
            f"online · HeyMaa tracked ${tracked:.4f} · prepaid $ only in AI Studio Billing"
        )
        out["msg"] = out["summary"]
        return out
    except Exception as e:
        out["msg"] = str(e)[:160]
        out["summary"] = out["msg"]
        return out


def collect_provider_balances(
    keys: dict[str, str],
    *,
    tracked_cost_usd: Optional[dict[str, float]] = None,
) -> dict[str, Any]:
    tracked = tracked_cost_usd or {}
    groq = probe_groq_limits(keys.get("groq") or "")
    gemini = probe_gemini_headroom(keys.get("gemini") or "", float(tracked.get("gemini") or 0))
    claude = probe_claude_spend(keys.get("claude") or "")
    return {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "providers": {
            "groq": groq,
            "gemini": gemini,
            "claude": claude,
        },
        "disclaimer": (
            "None of these vendors expose prepaid dollar balance on the chat API key. "
            "Grok (xAI) shows online status; Claude can show Admin month spend; "
            "Gemini prepaid is only in AI Studio Billing."
        ),
    }
