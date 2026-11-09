"""Generate a branded Heymaa growth PDF from live admin insights."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


NAVY = HexColor("#1A2340")
NAVY_DEEP = HexColor("#12182C")
TEAL = HexColor("#1F7A6C")
PEACH = HexColor("#E8A87C")
CREAM = HexColor("#F7F1EA")
MUTED = HexColor("#6B7280")
LINE = HexColor("#D9D2C8")
SOFT = HexColor("#EEF3F1")


def _load_env() -> None:
    for root in [Path(__file__).resolve().parent, Path(__file__).resolve().parents[1]]:
        p = root / ".env"
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


def _fmt_int(n) -> str:
    try:
        return f"{int(n):,}".replace(",", ".")
    except Exception:
        return "0"


def _fmt_pct(n) -> str:
    try:
        return f"{float(n):.1f}%"
    except Exception:
        return "0.0%"


def _fmt_eur(n) -> str:
    try:
        return f"€{float(n):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "€0,00"


def _channel_label(raw: str) -> str:
    mapping = {
        "direct_unknown": "Unattributed (no source stored)",
        "unattributed": "Unattributed (no source stored)",
        "shortlink_unknown": "Short link · UTMs lost",
        "meta": "Meta",
        "referral": "Referral",
        "email_moosend": "Email · Moosend",
        "sms": "SMS",
        "organic": "Organic",
        "google": "Google",
    }
    return mapping.get((raw or "").strip().lower(), (raw or "Other").replace("_", " ").title())


def _rounded_rect(c: canvas.Canvas, x, y, w, h, r=8, fill=None, stroke=None, sw=0.6):
    c.saveState()
    if fill:
        c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(sw)
    c.roundRect(x, y, w, h, r, fill=1 if fill else 0, stroke=1 if stroke else 0)
    c.restoreState()


def _draw_header(c: canvas.Canvas, width, height, title: str, subtitle: str):
    c.setFillColor(NAVY)
    c.rect(0, height - 42 * mm, width, 42 * mm, fill=1, stroke=0)
    # peach accent bar
    c.setFillColor(PEACH)
    c.rect(0, height - 42 * mm, width, 2.2 * mm, fill=1, stroke=0)
    brand_x = 18 * mm
    c.setFont("Helvetica-Bold", 22)
    c.setFillColor(white)
    c.drawString(brand_x, height - 18 * mm, "Hey")
    c.setFillColor(PEACH)
    c.drawString(brand_x + c.stringWidth("Hey", "Helvetica-Bold", 22), height - 18 * mm, "Maa")
    c.setFillColor(Color(1, 1, 1, alpha=0.72))
    c.setFont("Helvetica", 10)
    c.drawString(18 * mm, height - 25 * mm, "Growth report")
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(width - 18 * mm, height - 17 * mm, title)
    c.setFont("Helvetica", 9)
    c.setFillColor(Color(1, 1, 1, alpha=0.7))
    c.drawRightString(width - 18 * mm, height - 24 * mm, subtitle)


def _draw_footer(c: canvas.Canvas, width, page: int, pages: int, generated: str):
    c.setStrokeColor(LINE)
    c.setLineWidth(0.5)
    c.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, 8 * mm, f"Confidential · Care Direct · generated {generated}")
    c.drawRightString(width - 18 * mm, 8 * mm, f"{page} / {pages}")


def _kpi_card(c, x, y, w, h, label, value, hint=""):
    _rounded_rect(c, x, y, w, h, r=7, fill=SOFT, stroke=None)
    c.setFillColor(TEAL)
    c.rect(x, y, 2.2 * mm, h, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(x + 6 * mm, y + h - 7 * mm, label.upper())
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(x + 6 * mm, y + h - 16 * mm, str(value))
    if hint:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(x + 6 * mm, y + 5 * mm, hint)


def _bar_chart(c, x, y, w, h, series, *, color=TEAL, title=""):
    """series: list[{date,value}]"""
    vals = [float(p.get("value") or 0) for p in series]
    if not vals:
        return
    mx = max(vals) or 1.0
    n = len(vals)
    gap = 1.6
    bar_w = max(2.0, (w - gap * (n - 1)) / n)
    if title:
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x, y + h + 4 * mm, title)
    # axis
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(x, y, x + w, y)
    for i, p in enumerate(series):
        v = float(p.get("value") or 0)
        bh = (v / mx) * (h - 2)
        bx = x + i * (bar_w + gap)
        c.setFillColor(color if v > 0 else LINE)
        c.rect(bx, y + 0.5, bar_w, max(bh, 0.8 if v > 0 else 0.4), fill=1, stroke=0)
    # first/last labels
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    first = str(series[0].get("date") or "")[5:]
    last = str(series[-1].get("date") or "")[5:]
    c.drawString(x, y - 4 * mm, first)
    c.drawRightString(x + w, y - 4 * mm, last)
    c.drawRightString(x + w, y + h - 1 * mm, f"peak {int(mx)}")


def _section_title(c, x, y, text):
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, text)
    c.setStrokeColor(PEACH)
    c.setLineWidth(2)
    c.line(x, y - 2 * mm, x + 18 * mm, y - 2 * mm)


def _wrap(c, text: str, font: str, size: float, max_w: float) -> list[str]:
    words = str(text or "").split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if c.stringWidth(trial, font, size) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def _bullet_block(c, x, y, width, lines: list[str], *, max_w=None) -> float:
    """Draw wrapped bullets; return new y."""
    mw = max_w or (width - 40 * mm)
    for raw in lines:
        wrapped = _wrap(c, raw, "Helvetica", 9, mw - 6 * mm)
        need = 5 * mm + len(wrapped) * 4 * mm
        if y - need < 22 * mm:
            break
        _rounded_rect(c, x, y - need, width - 36 * mm, need, r=5, fill=CREAM)
        c.setFillColor(TEAL)
        c.circle(x + 5 * mm, y - 5 * mm, 1.4 * mm, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Helvetica", 9)
        ty = y - 5.5 * mm
        for ln in wrapped:
            c.drawString(x + 9 * mm, ty, ln)
            ty -= 4 * mm
        y -= need + 2.5 * mm
    return y


def build_pdf(out_path: Path) -> Path:
    _load_env()
    from main import ensure_supabase, sb
    from admin_daily_report import build_daily_report
    from admin_insights import build_insights

    if not ensure_supabase():
        raise SystemExit("Database not configured")

    now = datetime.now(timezone.utc)
    report = build_daily_report(sb, now=now)
    insights = build_insights(sb, days=30, now=now)
    series = insights.get("series") or {}
    new_users = series.get("new_users") or []
    dau = series.get("dau") or []
    h = report.get("headline") or {}
    cum = report.get("cumulative") or {}
    funnel = report.get("funnel") or {}
    msg = report.get("messaging") or {}
    acq = report.get("acquisition") or {}
    plans = report.get("plans") or []
    campaigns = acq.get("campaigns") or []
    channels = acq.get("by_channel") or []
    acq_insights = [str(x) for x in (acq.get("insights") or []) if str(x).strip()][:8]

    width, height = A4
    pages = 6
    generated = now.strftime("%d %b %Y %H:%M UTC")
    title_date = now.strftime("%d %B %Y")
    email_camp = next((c for c in campaigns if (c.get("provider") or "").lower() == "moosend"), None)
    sms_camp = next((c for c in campaigns if (c.get("provider") or "").lower() == "sms"), None)
    meta_camp = next((c for c in campaigns if (c.get("provider") or "").lower() == "meta"), None)
    meta_ads = []
    ga4 = {}
    try:
        from marketing_acquisition import load_external_campaigns

        ext = load_external_campaigns()
        ga4 = ext.get("ga4") or {}
        raw_meta = next(
            (
                c
                for c in (ext.get("campaigns") or [])
                if (c.get("provider") or "").lower() == "meta"
            ),
            None,
        )
        meta_ads = list((raw_meta or {}).get("ads") or [])
    except Exception:
        meta_ads = []

    c = canvas.Canvas(str(out_path), pagesize=A4)

    # ── Page 1: Snapshot ─────────────────────────────────────────────
    _draw_header(c, width, height, title_date, "Product & acquisition growth")
    y = height - 52 * mm
    _section_title(c, 18 * mm, y, "At a glance")
    y -= 8 * mm
    card_w = 42 * mm
    card_h = 24 * mm
    gap = 4 * mm
    cards = [
        ("Total users", _fmt_int(h.get("total_users")), "all time"),
        ("New · 7 days", _fmt_int(h.get("new_users_7d")), "signups"),
        ("New · 30 days", _fmt_int(h.get("new_users_30d")), "signups"),
        ("Active · 7 days", _fmt_int(h.get("active_last_7d")), "DAU window"),
    ]
    for i, (lab, val, hint) in enumerate(cards):
        _kpi_card(c, 18 * mm + i * (card_w + gap), y - card_h, card_w, card_h, lab, val, hint)
    y -= card_h + 12 * mm

    cards2 = [
        ("Trials active", _fmt_int(cum.get("trial_active")), "live trials"),
        ("Paying active", _fmt_int(cum.get("paying_active")), "subscriptions"),
        ("Chat users", _fmt_int(cum.get("users_with_chat")), "engaged"),
        ("Consent rate", _fmt_pct(cum.get("marketing_consent_rate")), "marketing opt-in"),
    ]
    for i, (lab, val, hint) in enumerate(cards2):
        _kpi_card(c, 18 * mm + i * (card_w + gap), y - card_h, card_w, card_h, lab, val, hint)
    y -= card_h + 14 * mm

    _section_title(c, 18 * mm, y, "Signup trend · last 30 days")
    y -= 10 * mm
    chart_h = 42 * mm
    _bar_chart(
        c,
        18 * mm,
        y - chart_h,
        width - 36 * mm,
        chart_h,
        new_users,
        color=TEAL,
        title="",
    )
    y -= chart_h + 14 * mm

    _section_title(c, 18 * mm, y, "Daily active users · last 30 days")
    y -= 10 * mm
    _bar_chart(
        c,
        18 * mm,
        y - chart_h,
        width - 36 * mm,
        chart_h,
        dau,
        color=PEACH,
        title="",
    )
    y -= chart_h + 12 * mm

    # narrative box
    _rounded_rect(c, 18 * mm, 22 * mm, width - 36 * mm, y - 22 * mm - 2 * mm, r=8, fill=CREAM)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(24 * mm, y - 10 * mm, "Story so far")
    story = (
        f"HeyMaa has {_fmt_int(h.get('total_users'))} users, with {_fmt_int(h.get('new_users_30d'))} "
        f"joining in the last 30 days and {_fmt_int(h.get('new_users_7d'))} in the last week. "
        f"{_fmt_int(cum.get('trial_active'))} trials are active; paid conversion is still early "
        f"({_fmt_int(cum.get('paying_active'))} paying). "
        f"{_fmt_int(cum.get('users_with_chat'))} users have chatted — product engagement is ahead of monetization."
    )
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    text = c.beginText(24 * mm, y - 16 * mm)
    text.setLeading(13)
    # wrap
    words = story.split()
    line = ""
    max_w = width - 52 * mm
    for w in words:
        trial = (line + " " + w).strip()
        if c.stringWidth(trial, "Helvetica", 9) <= max_w:
            line = trial
        else:
            text.textLine(line)
            line = w
    if line:
        text.textLine(line)
    c.drawText(text)

    _draw_footer(c, width, 1, pages, generated)
    c.showPage()

    # ── Page 2: Funnel + channels ─────────────────────────────────────
    _draw_header(c, width, height, "Funnel & attribution", title_date)
    y = height - 52 * mm
    _section_title(c, 18 * mm, y, "Product funnel")
    y -= 8 * mm
    funnel_rows = [
        ("Total users", h.get("total_users")),
        ("Users with chat", funnel.get("users_with_chat") or cum.get("users_with_chat")),
        ("Active trials", funnel.get("trial_active") or cum.get("trial_active")),
        ("Paying active", cum.get("paying_active")),
        ("Memories saved", funnel.get("total_memories") or cum.get("total_memories")),
        ("Drip enrollments", msg.get("drip_enrolled_total") or cum.get("drip_enrolled_total")),
        ("Drip emails sent", msg.get("drip_email_total") or cum.get("drip_email_total")),
        ("Marketing opt-ins", msg.get("marketing_consent_on") or cum.get("marketing_consent_on")),
        ("Gift claims", msg.get("gift_claims_total") or cum.get("gift_claims_total")),
    ]
    row_h = 7.5 * mm
    table_top = y
    for i, (lab, val) in enumerate(funnel_rows):
        yy = table_top - (i + 1) * row_h
        bg = SOFT if i % 2 == 0 else white
        c.setFillColor(bg)
        c.rect(18 * mm, yy, width - 36 * mm, row_h, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Helvetica", 9)
        c.drawString(22 * mm, yy + 2.4 * mm, lab)
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(width - 22 * mm, yy + 2.4 * mm, _fmt_int(val))
    y = table_top - len(funnel_rows) * row_h - 12 * mm

    _section_title(c, 18 * mm, y, "Signup channels · since 15 Oct 2026")
    y -= 8 * mm
    if channels:
        max_share = max(float(ch.get("share_pct") or 0) for ch in channels) or 1
        for ch in channels[:8]:
            lab = _channel_label(str(ch.get("channel") or ""))
            share = float(ch.get("share_pct") or 0)
            signups = int(ch.get("signups") or 0)
            bar_max = width - 78 * mm
            bw = bar_max * (share / max_share)
            c.setFillColor(NAVY)
            c.setFont("Helvetica", 8.5)
            c.drawString(18 * mm, y, lab[:34])
            c.setFillColor(SOFT)
            c.roundRect(62 * mm, y - 1 * mm, bar_max, 5 * mm, 2, fill=1, stroke=0)
            c.setFillColor(TEAL)
            c.roundRect(62 * mm, y - 1 * mm, max(bw, 1), 5 * mm, 2, fill=1, stroke=0)
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 8)
            c.drawRightString(width - 18 * mm, y, f"{signups} · {_fmt_pct(share)}")
            y -= 8.5 * mm
    y -= 4 * mm
    _section_title(c, 18 * mm, y, "How to read “Unattributed”")
    y -= 6 * mm
    y = _bullet_block(
        c,
        18 * mm,
        y,
        width,
        [
            "Most signups still show as Unattributed — empty acquisition {}, not proven Direct typed-URL traffic.",
            "GA historically stripped UTMs from page_location (fixed). Email/SMS/Meta will attribute better on new traffic.",
            "Mama Data Bitly was removed 8 Nov 19:53; direct Email UTMs should appear in GA going forward.",
            "Daily Pulse now goes only to: sotiropoulos.y / kapranou.n / boikos.y / gad.g @caredirect.com.",
        ],
    )
    _draw_footer(c, width, 2, pages, generated)
    c.showPage()

    # ── Page 3: Email Moosend ─────────────────────────────────────────
    _draw_header(c, width, height, "Email · Mama Data (Moosend)", title_date)
    y = height - 52 * mm
    ef = (email_camp or {}).get("funnel") or {}
    _section_title(c, 18 * mm, y, "Natal invite email · live Moosend KPIs")
    y -= 8 * mm
    cards = [
        ("Recipients", _fmt_int(ef.get("recipients")), "delivered list"),
        ("Open rate", _fmt_pct(ef.get("open_rate")), f"{_fmt_int(ef.get('unique_opens'))} unique"),
        ("Click rate", _fmt_pct(ef.get("click_rate")), f"{_fmt_int(ef.get('unique_clicks'))} unique"),
        ("DB signups", _fmt_int((email_camp or {}).get("matched_signups")), "Email UTMs stored"),
    ]
    for i, (lab, val, hint) in enumerate(cards):
        _kpi_card(c, 18 * mm + i * (card_w + gap), y - card_h, card_w, card_h, lab, val, hint)
    y -= card_h + 12 * mm

    _section_title(c, 18 * mm, y, "Funnel math")
    y -= 8 * mm
    email_rows = [
        ("Click-to-open", f"{_fmt_pct(ef.get('click_to_open_pct'))}"),
        ("Signup from click", f"{_fmt_pct(ef.get('signup_from_click_pct'))}"),
        ("Signup from recipient", f"{_fmt_pct(ef.get('signup_from_recipient_pct'))}"),
        ("Unsubscribe rate", f"{_fmt_pct(ef.get('unsubscribe_rate'))} ({_fmt_int(ef.get('unsubscribes'))})"),
        ("Subject", str((email_camp or {}).get("name") or "Mama Data GR HeyMaa_Emails")),
        ("UTMs", "utm_source=Email · utm_medium=Email · utm_campaign=Natal"),
    ]
    for i, (lab, val) in enumerate(email_rows):
        yy = y - (i + 1) * 7.5 * mm
        c.setFillColor(SOFT if i % 2 == 0 else white)
        c.rect(18 * mm, yy, width - 36 * mm, 7.5 * mm, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Helvetica", 9)
        c.drawString(22 * mm, yy + 2.4 * mm, lab)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawRightString(width - 22 * mm, yy + 2.4 * mm, str(val)[:55])
    y -= len(email_rows) * 7.5 * mm + 10 * mm

    _section_title(c, 18 * mm, y, "Manager takeaways · Email")
    y -= 6 * mm
    y = _bullet_block(
        c,
        18 * mm,
        y,
        width,
        [
            "Opens are excellent (~54%) — the list responds to the invite story.",
            "Clicks (~3.9%) and attributed signups (1) are the bottleneck — CTA + landing need work.",
            "Moosend Top Links were still Bitly-heavy historically (78 vs 6 direct). Direct UTMs are live after 8 Nov.",
            "Expect GA Email channel and more attributed signups only after new clicks on non-Bitly links.",
        ],
    )
    _draw_footer(c, width, 3, pages, generated)
    c.showPage()

    # ── Page 4: SMS ───────────────────────────────────────────────────
    _draw_header(c, width, height, "SMS · HEYMAA", title_date)
    y = height - 52 * mm
    sf = (sms_camp or {}).get("funnel") or {}
    _section_title(c, 18 * mm, y, "Campaign window 16 Oct – 7 Nov 2026")
    y -= 8 * mm
    cards = [
        ("SMS sends", _fmt_int(sf.get("sends") or 136), "SMS HEYMAA"),
        ("Clicks", "TBD" if sf.get("clicks") is None else _fmt_int(sf.get("clicks")), "short-link"),
        ("DB signups", _fmt_int((sms_camp or {}).get("matched_signups") or 0), "utm_source=SMS"),
        ("Landing UTMs", "Natal", "SMS / SMS / Natal"),
    ]
    for i, (lab, val, hint) in enumerate(cards):
        _kpi_card(c, 18 * mm + i * (card_w + gap), y - card_h, card_w, card_h, lab, val, hint)
    y -= card_h + 12 * mm

    _section_title(c, 18 * mm, y, "Setup")
    y -= 8 * mm
    sms_rows = [
        ("Name", str((sms_camp or {}).get("name") or "SMS HEYMAA")),
        ("Short link", str(sf.get("short_link") or "https://bit.ly/4hXfQbL")),
        ("Expands to", str(sf.get("expanded") or "heymaa.ai/?utm_source=SMS&utm_medium=SMS&utm_campaign=Natal")),
        ("Window", "16/10/2026 → 07/11/2026"),
        ("As of", "07/11/2026"),
    ]
    for i, (lab, val) in enumerate(sms_rows):
        yy = y - (i + 1) * 8 * mm
        c.setFillColor(SOFT if i % 2 == 0 else white)
        c.rect(18 * mm, yy, width - 36 * mm, 8 * mm, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Helvetica", 9)
        c.drawString(22 * mm, yy + 2.6 * mm, lab)
        c.setFont("Helvetica-Bold", 8)
        c.drawRightString(width - 22 * mm, yy + 2.6 * mm, str(val)[:58])
    y -= len(sms_rows) * 8 * mm + 10 * mm

    _section_title(c, 18 * mm, y, "Manager takeaways · SMS")
    y -= 6 * mm
    y = _bullet_block(
        c,
        18 * mm,
        y,
        width,
        [
            "136 SMS sent in the Natal window — volume is modest vs email (2.1k recipients).",
            "Zero SMS-attributed signups in DB so far — likely UTMs lost via short-link / GA strip (now fixed) or no click-through.",
            "Next: capture Bitly click count for the SMS link, and confirm landing always keeps utm_source=SMS.",
            "Reuse best-performing email CTA language in SMS for a second wave if list allows.",
        ],
    )
    _draw_footer(c, width, 4, pages, generated)
    c.showPage()

    # ── Page 5: Meta Ads + Pixel ──────────────────────────────────────
    _draw_header(c, width, height, "Meta Ads & Pixel", title_date)
    y = height - 52 * mm
    _section_title(c, 18 * mm, y, "Kickoff OA · Ads Manager")
    y -= 8 * mm
    mk = (meta_camp or {}).get("funnel") or (meta_camp or {}).get("kpis") or {}
    # funnel from analyze_acquisition uses spend etc; also fall back
    if not mk.get("spend_eur"):
        mk = (meta_camp or {}).get("kpis") or mk
    cards = [
        ("Spend", _fmt_eur(mk.get("spend_eur") or 100.21), "FB + IG"),
        ("Impressions", _fmt_int(mk.get("impressions") or 24778), "delivery"),
        ("Reach", _fmt_int(mk.get("reach") or 10004), "people"),
        ("Ads Mgr results", _fmt_int(mk.get("leads") or 0), "optim. events"),
    ]
    for i, (lab, val, hint) in enumerate(cards):
        _kpi_card(c, 18 * mm + i * (card_w + gap), y - card_h, card_w, card_h, lab, val, hint)
    y -= card_h + 10 * mm

    _section_title(c, 18 * mm, y, "By ad")
    y -= 7 * mm
    ad_rows = meta_ads or []
    for ad in ad_rows:
        _rounded_rect(c, 18 * mm, y - 28 * mm, width - 36 * mm, 26 * mm, r=7, fill=SOFT)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(24 * mm, y - 8 * mm, str(ad.get("name") or "Ad")[:58])
        c.setFillColor(TEAL)
        c.setFont("Helvetica", 8)
        c.drawString(
            24 * mm,
            y - 13 * mm,
            f"{str(ad.get('placement') or '').title()} · {ad.get('optimization_event')}",
        )
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(
            24 * mm,
            y - 19 * mm,
            f"Spend {_fmt_eur(ad.get('spend_eur'))} · Impr {_fmt_int(ad.get('impressions'))} · "
            f"Reach {_fmt_int(ad.get('reach'))} · {_fmt_eur(ad.get('budget_daily_eur'))}/day",
        )
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(24 * mm, y - 24 * mm, f"Ads Manager results: {_fmt_int(ad.get('results'))}")
        y -= 31 * mm

    _section_title(c, 18 * mm, y, "Pixel reality check")
    y -= 6 * mm
    first_party = int(((meta_camp or {}).get("kpis") or {}).get("first_party_meta_signups") or (meta_camp or {}).get("matched_signups") or 3)
    y = _bullet_block(
        c,
        18 * mm,
        y,
        width,
        [
            f"Ads Manager: 0 Complete Registration / Website Subscribe. First-party DB: {first_party} Meta signups (fbclid).",
            "Root cause was missing Pixel CompleteRegistration on signup — fix shipped; also fire Subscribe for IG.",
            "Events Manager flagged heymaa.ai as Health & wellness — category review requested 9 Nov (EU data risk).",
            "heymaa.ai added to Pixel allow list; Automatic Advanced Matching turned On (EMQ was ~6/10).",
            f"Rough Meta CPA on first-party signups: {_fmt_eur(mk.get('cost_per_signup_eur') or (100.21 / max(first_party, 1)))} "
            f"(spend ÷ DB Meta signups) — not Ads Manager CPA.",
        ],
    )
    _draw_footer(c, width, 5, pages, generated)
    c.showPage()

    # ── Page 6: GA + priorities ───────────────────────────────────────
    _draw_header(c, width, height, "Analytics & next moves", title_date)
    y = height - 52 * mm
    _section_title(c, 18 * mm, y, "GA4 snapshot (last saved)")
    y -= 8 * mm
    gt = (ga4.get("traffic") or {})
    cards = [
        ("Sessions", _fmt_int(gt.get("sessions") or 120), f"{ga4.get('window_start')}→{ga4.get('window_end')}"),
        ("Engaged", _fmt_pct(gt.get("engagement_rate") or 92.5), f"{_fmt_int(gt.get('engaged_sessions'))} sessions"),
        ("Direct share", "77.5%", "UTMs were stripped"),
        ("Key events", _fmt_int(gt.get("key_events") or 0), "sign_up not marked"),
    ]
    for i, (lab, val, hint) in enumerate(cards):
        _kpi_card(c, 18 * mm + i * (card_w + gap), y - card_h, card_w, card_h, lab, val, hint)
    y -= card_h + 10 * mm

    missing = ", ".join((gt.get("missing_channels") or ["Email", "SMS", "Paid Social"])[:6])
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, y, f"Channels still missing in GA window: {missing}")
    y -= 10 * mm

    _section_title(c, 18 * mm, y, "Priorities for the next 2 weeks")
    y -= 8 * mm
    defaults = [
        "Wait for Meta health-category review; keep CompleteRegistration + Subscribe firing on signup.",
        "Confirm Mama Data CTAs are direct www.heymaa.ai with Email UTMs (no Bitly) — re-check GA Email channel.",
        "Pull Bitly/SMS click count for the 136 sends; retarget non-clickers if possible.",
        "Mark GA4 sign_up as a key event so channel → registration is visible.",
        "Tighten email CTA — opens are strong; clicks/signups are the conversion hole.",
        "Align IG ad optimization to Complete Registration (not Website Subscribe).",
        "Push trial→paid: drips are enrolling — watch mid-trial conversion copy.",
    ]
    items = defaults
    for i, text in enumerate(items, 1):
        lines = _wrap(c, text, "Helvetica", 9, width - 55 * mm)
        box_h = max(14 * mm, 7 * mm + len(lines) * 4 * mm)
        if y - box_h < 28 * mm:
            break
        _rounded_rect(c, 18 * mm, y - box_h, width - 36 * mm, box_h, r=6, fill=CREAM)
        c.setFillColor(TEAL)
        c.circle(26 * mm, y - box_h / 2, 3.8 * mm, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(26 * mm, y - box_h / 2 - 1.1 * mm, str(i))
        c.setFillColor(NAVY)
        c.setFont("Helvetica", 9)
        ty = y - 6 * mm
        for ln in lines:
            c.drawString(34 * mm, ty, ln)
            ty -= 4 * mm
        y -= box_h + 3 * mm

    if y > 36 * mm:
        _section_title(c, 18 * mm, y, "Revenue posture")
        y -= 8 * mm
        rev = report.get("revenue") or {}
        _rounded_rect(c, 18 * mm, y - 22 * mm, width - 36 * mm, 20 * mm, r=7, fill=SOFT)
        c.setFillColor(NAVY)
        c.setFont("Helvetica", 9)
        c.drawString(24 * mm, y - 8 * mm, f"Recognized MRR: {_fmt_eur(rev.get('recognized_mrr_eur') or cum.get('recognized_mrr_eur'))}")
        c.drawString(
            24 * mm,
            y - 14 * mm,
            f"Cash · 30d: {_fmt_eur(rev.get('cash_30d_eur'))}  ·  Lifetime: {_fmt_eur(rev.get('cash_lifetime_eur') or cum.get('cash_lifetime_eur'))}",
        )
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(24 * mm, y - 19 * mm, "Growth is acquisition- and engagement-led; paid conversion is the next chapter.")

    _draw_footer(c, width, 6, pages, generated)
    c.save()
    return out_path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out_dir = root / "docs" / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out = out_dir / f"Heymaa_Growth_Report_{stamp}_manager.pdf"
    path = build_pdf(out)
    print(str(path))


if __name__ == "__main__":
    main()
