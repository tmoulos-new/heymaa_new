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
    pages = 3
    generated = now.strftime("%d %b %Y %H:%M UTC")
    title_date = now.strftime("%d %B %Y")

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

    # ── Page 2: Engagement & acquisition ─────────────────────────────
    _draw_header(c, width, height, "Engagement & acquisition", title_date)
    y = height - 52 * mm
    _section_title(c, 18 * mm, y, "Product funnel")
    y -= 8 * mm
    funnel_rows = [
        ("Total users", h.get("total_users")),
        ("Users with chat", funnel.get("users_with_chat")),
        ("Active trials", funnel.get("trial_active")),
        ("Memories saved", funnel.get("total_memories")),
        ("Drip enrollments", msg.get("drip_enrolled_total")),
        ("Drip emails sent", msg.get("drip_email_total")),
        ("Marketing opt-ins", msg.get("marketing_consent_on")),
        ("Gift claims", msg.get("gift_claims_total")),
    ]
    row_h = 8 * mm
    table_top = y
    for i, (lab, val) in enumerate(funnel_rows):
        yy = table_top - (i + 1) * row_h
        bg = SOFT if i % 2 == 0 else white
        c.setFillColor(bg)
        c.rect(18 * mm, yy, width - 36 * mm, row_h, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Helvetica", 9)
        c.drawString(22 * mm, yy + 2.6 * mm, lab)
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(width - 22 * mm, yy + 2.6 * mm, _fmt_int(val))
    y = table_top - len(funnel_rows) * row_h - 12 * mm

    _section_title(c, 18 * mm, y, "Signup channels · since Oct 15")
    y -= 8 * mm
    if channels:
        max_share = max(float(ch.get("share_pct") or 0) for ch in channels) or 1
        for ch in channels[:6]:
            lab = _channel_label(str(ch.get("channel") or ""))
            share = float(ch.get("share_pct") or 0)
            signups = int(ch.get("signups") or 0)
            bar_max = width - 70 * mm
            bw = bar_max * (share / max_share)
            c.setFillColor(NAVY)
            c.setFont("Helvetica", 9)
            c.drawString(18 * mm, y, lab)
            c.setFillColor(SOFT)
            c.roundRect(55 * mm, y - 1 * mm, bar_max, 5 * mm, 2, fill=1, stroke=0)
            c.setFillColor(TEAL)
            c.roundRect(55 * mm, y - 1 * mm, max(bw, 1), 5 * mm, 2, fill=1, stroke=0)
            c.setFillColor(MUTED)
            c.setFont("Helvetica", 8)
            c.drawRightString(width - 18 * mm, y, f"{signups} · {_fmt_pct(share)}")
            y -= 9 * mm
    else:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 9)
        c.drawString(18 * mm, y, "No channel attribution yet.")
        y -= 10 * mm

    y -= 6 * mm
    _section_title(c, 18 * mm, y, "Plan mix")
    y -= 8 * mm
    if plans:
        for p in plans:
            name = str(p.get("name") or "?")
            users = int(p.get("users") or 0)
            c.setFillColor(NAVY)
            c.setFont("Helvetica", 9)
            c.drawString(18 * mm, y, name)
            c.setFont("Helvetica-Bold", 9)
            c.drawRightString(width - 18 * mm, y, _fmt_int(users))
            y -= 7 * mm
    else:
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 9)
        c.drawString(18 * mm, y, "No plan breakdown available.")
        y -= 8 * mm

    y -= 8 * mm
    _section_title(c, 18 * mm, y, "External campaigns")
    y -= 8 * mm
    for camp in campaigns[:3]:
        name = str(camp.get("name") or "Campaign")
        provider = str(camp.get("provider") or "").title()
        kpis = camp.get("kpis") or {}
        _rounded_rect(c, 18 * mm, y - 28 * mm, width - 36 * mm, 26 * mm, r=7, fill=SOFT)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(24 * mm, y - 8 * mm, name[:70])
        c.setFillColor(TEAL)
        c.setFont("Helvetica", 8)
        c.drawString(24 * mm, y - 13 * mm, provider)
        bits = []
        if kpis.get("recipients") is not None:
            bits.append(f"Recipients {_fmt_int(kpis.get('recipients'))}")
        if kpis.get("open_rate") is not None:
            bits.append(f"Open {_fmt_pct(kpis.get('open_rate'))}")
        if kpis.get("click_rate") is not None:
            bits.append(f"Click {_fmt_pct(kpis.get('click_rate'))}")
        if kpis.get("unique_clicks") is not None:
            bits.append(f"Clicks {_fmt_int(kpis.get('unique_clicks'))}")
        if kpis.get("note"):
            bits.append(str(kpis.get("note"))[:90])
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        c.drawString(24 * mm, y - 20 * mm, " · ".join(bits)[:110] or "KPIs pending")
        y -= 32 * mm

    _draw_footer(c, width, 2, pages, generated)
    c.showPage()

    # ── Page 3: Recommendations ──────────────────────────────────────
    _draw_header(c, width, height, "Priorities", title_date)
    y = height - 52 * mm
    _section_title(c, 18 * mm, y, "What to do next")
    y -= 10 * mm

    defaults = [
        "Keep UTMs on every Meta / SMS / email landing so Direct stops dominating attribution.",
        "Tighten Natal email CTA — opens are strong; clicks and attributed signups are the bottleneck.",
        "Move trials → paid with a clear mid-trial nudge (drip is already enrolling users).",
        "Mark sign_up as a GA4 key event so channel → registration is visible in Analytics.",
        "Paste Meta Ads and SMS send/click totals into campaign config for ROI in Pulse.",
    ]
    items = acq_insights[:6] if acq_insights else defaults
    for i, raw in enumerate(items, 1):
        text = raw.strip()
        if text.lower().startswith("action:"):
            text = text.split(":", 1)[1].strip()
        box_h = 18 * mm
        # estimate wrap height lightly
        words = text.split()
        lines = []
        line = ""
        max_w = width - 55 * mm
        for w in words:
            trial = (line + " " + w).strip()
            if c.stringWidth(trial, "Helvetica", 9) <= max_w:
                line = trial
            else:
                lines.append(line)
                line = w
        if line:
            lines.append(line)
        box_h = max(16 * mm, 8 * mm + len(lines) * 4.2 * mm)
        if y - box_h < 24 * mm:
            break
        _rounded_rect(c, 18 * mm, y - box_h, width - 36 * mm, box_h, r=7, fill=CREAM)
        c.setFillColor(TEAL)
        c.circle(26 * mm, y - box_h / 2, 4.2 * mm, fill=1, stroke=0)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString(26 * mm, y - box_h / 2 - 1.2 * mm, str(i))
        c.setFillColor(NAVY)
        c.setFont("Helvetica", 9)
        ty = y - 7 * mm
        for ln in lines[:5]:
            c.drawString(34 * mm, ty, ln)
            ty -= 4.2 * mm
        y -= box_h + 4 * mm

    y -= 4 * mm
    if y > 40 * mm:
        _section_title(c, 18 * mm, y, "Revenue posture")
        y -= 10 * mm
        _rounded_rect(c, 18 * mm, y - 28 * mm, width - 36 * mm, 26 * mm, r=7, fill=SOFT)
        c.setFillColor(NAVY)
        c.setFont("Helvetica", 9)
        rev = report.get("revenue") or {}
        c.drawString(24 * mm, y - 10 * mm, f"Recognized MRR: {_fmt_eur(rev.get('recognized_mrr_eur'))}")
        c.drawString(24 * mm, y - 16 * mm, f"Cash · 30 days: {_fmt_eur(rev.get('cash_30d_eur'))}  ·  Lifetime: {_fmt_eur(rev.get('cash_lifetime_eur'))}")
        c.setFillColor(MUTED)
        c.drawString(
            24 * mm,
            y - 22 * mm,
            "Growth is user- and engagement-led; monetization is the next chapter.",
        )

    _draw_footer(c, width, 3, pages, generated)
    c.save()
    return out_path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out_dir = root / "docs" / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out = out_dir / f"Heymaa_Growth_Report_{stamp}.pdf"
    path = build_pdf(out)
    print(str(path))


if __name__ == "__main__":
    main()
