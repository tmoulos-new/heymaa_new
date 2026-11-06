"""External campaign KPIs + signup acquisition analysis for Pulse digest."""
from __future__ import annotations

import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

_CONFIG_PATH = Path(__file__).resolve().parent / "config" / "external_campaigns.json"


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
            # date-only
            try:
                dt = datetime.fromisoformat(raw + "T00:00:00+00:00")
            except ValueError:
                return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _pct(part: float, whole: float) -> float:
    if whole <= 0:
        return 0.0
    return round(100.0 * float(part) / float(whole), 2)


def _env_float(name: str) -> Optional[float]:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _env_int(name: str) -> Optional[int]:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return None
    try:
        return int(float(raw))
    except ValueError:
        return None


def load_external_campaigns() -> dict[str, Any]:
    data: dict[str, Any] = {"campaigns": [], "notes": [], "updated_at": None}
    try:
        if _CONFIG_PATH.is_file():
            data = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        data["notes"] = [f"config read failed: {e}"]

    # Optional Meta KPI overrides from env (Ads Manager paste)
    for camp in data.get("campaigns") or []:
        if (camp.get("provider") or "").lower() != "meta":
            continue
        kpis = dict(camp.get("kpis") or {})
        for env_key, field in (
            ("META_IMPRESSIONS", "impressions"),
            ("META_REACH", "reach"),
            ("META_CLICKS", "clicks"),
            ("META_LEADS", "leads"),
        ):
            val = _env_int(env_key)
            if val is not None:
                kpis[field] = val
        spend = _env_float("META_SPEND_EUR")
        if spend is not None:
            kpis["spend_eur"] = spend
        ctr = _env_float("META_CTR")
        if ctr is not None:
            kpis["ctr"] = ctr
        if any(kpis.get(k) is not None for k in ("impressions", "clicks", "spend_eur", "leads")):
            kpis["as_of"] = datetime.now(timezone.utc).date().isoformat()
            kpis.pop("note", None)
        camp["kpis"] = kpis
    return data


def _channel_from_acquisition(acq: Any, invite_code: Any) -> str:
    if not isinstance(acq, dict):
        acq = {}
    source = str(acq.get("utm_source") or "").lower()
    medium = str(acq.get("utm_medium") or "").lower()
    if acq.get("fbclid") or "meta" in source or "facebook" in source or "instagram" in source:
        return "meta"
    if "moosend" in source or medium == "email" or source in ("email", "newsletter"):
        return "email_moosend"
    if acq.get("gclid") or "cpc" in medium or source == "google":
        return "google_ads"
    if source:
        return source[:40]
    if invite_code:
        return "invite"
    if acq.get("referrer"):
        return "referral"
    return "direct_unknown"


def analyze_acquisition(sb, *, window_start: str = "2026-10-15") -> dict[str, Any]:
    """Break down signups since campaign window by stored acquisition + invite."""
    external = load_external_campaigns()
    start = _parse_dt(window_start) or datetime(2026, 10, 15, tzinfo=timezone.utc)
    out: dict[str, Any] = {
        "window_start": start.date().isoformat(),
        "signups_in_window": 0,
        "by_channel": [],
        "attributed_share_pct": 0.0,
        "unknown_share_pct": 0.0,
        "campaigns": [],
        "insights": [],
        "notes": list(external.get("notes") or []),
    }
    if not sb:
        out["notes"].append("Database not configured")
        return out

    users: list[dict] = []
    try:
        # Prefer acquisition column; fall back if migration not applied
        try:
            res = (
                sb.table("users")
                .select("id,email,created_at,invite_code,role,acquisition,subscription_status,plan_id")
                .gte("created_at", start.isoformat())
                .limit(5000)
                .execute()
            )
            users = list(res.data or [])
        except Exception:
            res = (
                sb.table("users")
                .select("id,email,created_at,invite_code,role,subscription_status,plan_id")
                .gte("created_at", start.isoformat())
                .limit(5000)
                .execute()
            )
            users = list(res.data or [])
            out["notes"].append(
                "users.acquisition column missing — run backend/migrations/user_acquisition.sql"
            )
    except Exception as e:
        out["notes"].append(f"users query: {e}")
        return out

    counts: Counter = Counter()
    paying_by: Counter = Counter()
    attributed = 0
    for u in users:
        if str(u.get("role") or "").lower() == "admin":
            continue
        acq = u.get("acquisition") if isinstance(u.get("acquisition"), dict) else {}
        ch = _channel_from_acquisition(acq, u.get("invite_code"))
        counts[ch] += 1
        if ch not in ("direct_unknown",):
            attributed += 1
        status = (u.get("subscription_status") or "").lower()
        plan = (u.get("plan_id") or u.get("plan") or "").lower()
        if status == "active" and plan not in ("trial", "free", ""):
            paying_by[ch] += 1

    total = sum(counts.values())
    out["signups_in_window"] = total
    out["by_channel"] = [
        {
            "channel": ch,
            "signups": n,
            "share_pct": _pct(n, total),
            "paying": int(paying_by.get(ch) or 0),
            "pay_rate_pct": _pct(paying_by.get(ch) or 0, n),
        }
        for ch, n in counts.most_common()
    ]
    out["attributed_share_pct"] = _pct(attributed, total)
    out["unknown_share_pct"] = _pct(counts.get("direct_unknown", 0), total)

    # Enrich each external campaign with funnel math vs window signups
    campaign_blocks = []
    for camp in external.get("campaigns") or []:
        kpis = camp.get("kpis") or {}
        provider = (camp.get("provider") or "").lower()
        utm_source = (camp.get("utm_source") or "").lower()
        matched = 0
        for u in users:
            if str(u.get("role") or "").lower() == "admin":
                continue
            acq = u.get("acquisition") if isinstance(u.get("acquisition"), dict) else {}
            ch = _channel_from_acquisition(acq, u.get("invite_code"))
            if provider == "moosend" and ch == "email_moosend":
                matched += 1
            elif provider == "meta" and ch == "meta":
                matched += 1
            elif utm_source and str(acq.get("utm_source") or "").lower() == utm_source:
                matched += 1

        block = {
            "id": camp.get("id"),
            "name": camp.get("name"),
            "channel": camp.get("channel"),
            "provider": provider,
            "started_at": camp.get("started_at"),
            "subject": camp.get("subject"),
            "kpis": kpis,
            "matched_signups": matched,
            "report_url": camp.get("report_url"),
        }
        if provider == "moosend":
            recipients = int(kpis.get("recipients") or 0)
            opens = int(kpis.get("unique_opens") or 0)
            clicks = int(kpis.get("unique_clicks") or 0)
            block["funnel"] = {
                "recipients": recipients,
                "unique_opens": opens,
                "unique_clicks": clicks,
                "open_rate": float(kpis.get("open_rate") or _pct(opens, recipients)),
                "click_rate": float(kpis.get("click_rate") or _pct(clicks, recipients)),
                "click_to_open_pct": _pct(clicks, opens),
                "signup_from_click_pct": _pct(matched, clicks) if matched else None,
                "signup_from_recipient_pct": _pct(matched, recipients) if matched else None,
                "unsubscribes": int(kpis.get("unsubscribes") or 0),
                "unsubscribe_rate": float(kpis.get("unsubscribe_rate") or 0),
            }
        elif provider == "meta":
            impressions = kpis.get("impressions")
            clicks = kpis.get("clicks")
            spend = kpis.get("spend_eur")
            block["funnel"] = {
                "impressions": impressions,
                "clicks": clicks,
                "ctr": kpis.get("ctr"),
                "spend_eur": spend,
                "leads": kpis.get("leads"),
                "signup_from_click_pct": _pct(matched, clicks) if clicks and matched else None,
                "cost_per_signup_eur": round(float(spend) / matched, 2)
                if spend and matched
                else None,
                "incomplete": impressions is None and clicks is None,
            }
        campaign_blocks.append(block)
    out["campaigns"] = campaign_blocks

    # Narrative insights (what works)
    insights: list[str] = []
    moosend = next((c for c in campaign_blocks if c.get("provider") == "moosend"), None)
    if moosend and moosend.get("funnel"):
        f = moosend["funnel"]
        insights.append(
            f"Moosend: {f['open_rate']}% open is strong for cold/warm list; "
            f"click {f['click_rate']}% ({f['unique_clicks']} people) is the real funnel bottleneck."
        )
        insights.append(
            f"Moosend click-to-open {f['click_to_open_pct']}% — improve CTA/landing clarity "
            f"(use www.heymaa.ai/?utm_source=moosend&utm_medium=email&utm_campaign=mama_data_gr_first100)."
        )
        if f.get("signup_from_click_pct") is None:
            insights.append(
                "Cannot yet attribute Moosend → registrations in DB (UTM capture just added). "
                f"Window signups since {out['window_start']}: {total}."
            )
        else:
            insights.append(
                f"Attributed Moosend signups: {moosend['matched_signups']} "
                f"({f['signup_from_click_pct']}% of clicks)."
            )
        if f.get("unsubscribe_rate", 0) > 0.5:
            insights.append(
                f"Unsubscribe {f['unsubscribe_rate']}% ({f['unsubscribes']}) — watch list fatigue."
            )

    meta = next((c for c in campaign_blocks if c.get("provider") == "meta"), None)
    if meta and (meta.get("funnel") or {}).get("incomplete"):
        insights.append(
            "Meta Ads KPIs missing — paste from Ads Manager into "
            "backend/config/external_campaigns.json or META_IMPRESSIONS/META_CLICKS/META_SPEND_EUR."
        )
    elif meta and meta.get("matched_signups"):
        insights.append(
            f"Meta-attributed signups in window: {meta['matched_signups']}."
        )

    if total and out["unknown_share_pct"] > 70:
        insights.append(
            f"{out['unknown_share_pct']}% of signups since {out['window_start']} have no UTM/referrer yet — "
            "attribution improves for new signups after this deploy."
        )

    # Ranking channels by signup volume
    if out["by_channel"]:
        top = out["by_channel"][0]
        insights.append(
            f"Top recorded channel in window: {top['channel']} "
            f"({top['signups']} signups, {top['share_pct']}%)."
        )

    insights.append(
        "Fix: avoid heimaa.ai in SMS/email — that host errors; always use https://www.heymaa.ai with UTMs."
    )
    out["insights"] = insights
    return out
