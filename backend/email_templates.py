"""Branded transactional email templates for HeyMaa (Greek-first, English supported)."""

from __future__ import annotations

import base64
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime
from html import escape
from typing import Any, Optional

try:
    from .greek_text import greek_vocative
except ImportError:
    from greek_text import greek_vocative

# B2C palette (home.css + appAuth.css)
NAVY = "#2B3A67"
TEAL = "#4ABEAA"
CREAM = "#F5F0EB"
BEIGE = "#F8E5D6"
PEACH = "#F8E5D6"
MUTED = "#7A7068"
TEXT = "#2B3A67"
TEXT_SOFT = "rgba(43, 58, 103, 0.72)"
BORDER = "#F0EBE6"
INPUT_BORDER = "rgba(43, 58, 103, 0.14)"
FONT = "'DM Sans', Helvetica, Arial, sans-serif"
DEFAULT_APP_URL = "https://www.heymaa.ai"
LOGO_CID = "heymaa-logo"
LOGO_FILENAME = "logo-circle.png"

SUPPORT_EMAIL = "info@heymaa.ai"

_backend_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.abspath(os.path.join(_backend_dir, ".."))

_logo_attachment_cache: Optional[dict] = None


@dataclass(frozen=True)
class EmailMessage:
    subject: str
    html: str


def normalize_email_lang(lang: Optional[str]) -> str:
    code = (lang or "el").strip().lower()
    return "en" if code == "en" else "el"


def _font() -> str:
    return FONT


def _logo_file_paths() -> list[str]:
    return [
        os.path.join(_backend_dir, "static", "brand", LOGO_FILENAME),
        os.path.join(_root_dir, "static", "brand", LOGO_FILENAME),
        os.path.join(_root_dir, "frontend", "src", "assets", LOGO_FILENAME),
    ]


def _read_logo_bytes() -> Optional[bytes]:
    for path in _logo_file_paths():
        if os.path.isfile(path):
            with open(path, "rb") as handle:
                return handle.read()
    return None


def logo_attachment() -> Optional[dict]:
    """Resend inline attachment for the B2C circular logo (works in Gmail/Outlook)."""
    global _logo_attachment_cache
    if _logo_attachment_cache is not None:
        return _logo_attachment_cache

    raw = _read_logo_bytes()
    if not raw:
        _logo_attachment_cache = None
        return None

    _logo_attachment_cache = {
        "filename": LOGO_FILENAME,
        "content": base64.b64encode(raw).decode("ascii"),
        "content_id": LOGO_CID,
        "content_type": "image/png",
    }
    return _logo_attachment_cache


def _hosted_logo_src() -> str:
    """Public HTTPS logo URL — most reliable in Gmail/Outlook when images load."""
    explicit = (os.getenv("EMAIL_LOGO_URL") or "").strip()
    if explicit:
        return explicit
    base = (os.getenv("APP_URL") or DEFAULT_APP_URL).rstrip("/")
    return f"{base}/static/brand/{LOGO_FILENAME}"


def _logo_src() -> str:
    """Prefer inline CID when the PNG is bundled; else hosted URL."""
    if logo_attachment():
        return f"cid:{LOGO_CID}"
    return _hosted_logo_src()


def _brand_header() -> str:
    logo = escape(_logo_src(), quote=True)
    font = _font()
    return f"""
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{NAVY};border-radius:16px 16px 0 0;">
  <tr>
    <td align="center" style="padding:16px 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0">
        <tr>
          <td valign="middle" style="padding-right:10px;">
            <img src="{logo}" width="36" height="36" alt="HeyMaa"
              style="display:block;width:36px;height:36px;border-radius:50%;border:0;outline:none;" />
          </td>
          <td valign="middle" style="font-family:{font};font-size:22px;font-weight:600;color:#ffffff;line-height:1;">
            Hey<span style="color:{PEACH};">Maa</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>"""


def _first_name(name: Optional[str]) -> str:
    raw = (name or "").strip()
    if not raw:
        return ""
    return raw.split()[0]


def _display_name(name: Optional[str], lang: str) -> str:
    first = _first_name(name)
    if not first:
        return "there" if lang == "en" else "εσένα"
    if lang == "el":
        return greek_vocative(first)
    return first


def _plan_label(plan: str, lang: str) -> str:
    key = (plan or "").strip().lower()
    labels = {
        "starter": ("Starter — €13.99/μήνα", "Starter — €13.99/month"),
        "premium": ("Premium — €24.99/μήνα", "Premium — €24.99/month"),
        "annual": ("Ετήσιο Premium — €119.99/έτος", "Annual Premium — €119.99/year"),
        "annual_premium": ("Ετήσιο Premium — €119.99/έτος", "Annual Premium — €119.99/year"),
        "trial": ("Δωρεάν δοκιμή", "Free trial"),
    }
    pair = labels.get(key)
    if pair:
        return pair[1 if lang == "en" else 0]
    return plan or ("Συνδρομή" if lang == "el" else "Subscription")


def _gift_plan_name(plan: str, lang: str) -> str:
    key = (plan or "").strip().lower()
    if key in ("annual", "annual_premium"):
        return "Annual Premium" if lang == "en" else "Ετήσιο Premium"
    if key == "premium":
        return "Premium"
    if key == "starter":
        return "Starter"
    if key == "trial":
        return "Free trial" if lang == "en" else "Δωρεάν δοκιμή"
    return plan or ("plan" if lang == "en" else "πλάνο")


def _email_shell(body_html: str, *, preheader: str = "") -> str:
    preheader_html = ""
    if preheader:
        preheader_html = (
            f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
            f"{escape(preheader)}</div>"
        )
    font = _font()
    return f"""<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:{CREAM};">
{preheader_html}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{CREAM};">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
        <tr><td>{_brand_header()}</td></tr>
        <tr>
          <td style="background:#ffffff;padding:32px 28px 24px;border-left:1px solid {BORDER};border-right:1px solid {BORDER};">
            {body_html}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:0 28px 28px;border:1px solid {BORDER};border-top:0;border-radius:0 0 16px 16px;">
            <div style="border-top:1px solid {BORDER};padding-top:16px;font-family:{font};font-size:11px;color:{MUTED};line-height:1.6;text-align:center;">
              © 2026 HeyMaa · Care Direct · {escape(SUPPORT_EMAIL)}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>"""


def _paragraph(text: str) -> str:
    return (
        f'<p style="font-family:{_font()};font-size:15px;color:{TEXT_SOFT};'
        f'line-height:1.65;margin:0 0 16px;">{text}</p>'
    )


def _greeting(name: Optional[str], lang: str) -> str:
    who = escape(_display_name(name, lang))
    if lang == "en":
        return (
            f'<p style="font-family:{_font()};font-size:22px;font-weight:700;'
            f'color:{TEXT};line-height:1.35;margin:0 0 16px;text-align:center;">'
            f'Hi <strong>{who}</strong>! 👋</p>'
        )
    return (
        f'<p style="font-family:{_font()};font-size:22px;font-weight:700;'
        f'color:{TEXT};line-height:1.35;margin:0 0 16px;text-align:center;">'
        f'Γεια σου <strong>{who}</strong>! 👋</p>'
    )


def _button(href: str, label: str) -> str:
    return (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">'
        f'<tr><td align="center">'
        f'<a href="{escape(href, quote=True)}" style="font-family:{_font()};'
        f'background:{NAVY};color:#ffffff;padding:15px 32px;border-radius:999px;text-decoration:none;'
        f'font-size:16px;font-weight:600;display:inline-block;border:1.5px solid {NAVY};">'
        f'{escape(label)}</a></td></tr></table>'
    )


def _code_box(label: str, code: str) -> str:
    return (
        f'<div style="background:#ffffff;border-radius:12px;padding:18px 20px;margin:20px 0;text-align:center;'
        f'border:1.5px solid {INPUT_BORDER};">'
        f'<div style="font-family:{_font()};font-size:12px;font-weight:600;color:{TEXT};'
        f'margin-bottom:8px;letter-spacing:0.4px;">{escape(label)}</div>'
        f'<div style="font-family:{_font()};font-size:22px;font-weight:700;'
        f'color:{TEXT};letter-spacing:2px;">{escape(code)}</div></div>'
    )


def _steps_panel(title: str, steps: list[str]) -> str:
    items = "".join(
        f'<li style="margin-bottom:8px;">{step}</li>' for step in steps
    )
    return (
        f'<div style="background:{NAVY};border-radius:16px;padding:20px;margin:20px 0;">'
        f'<div style="font-family:{_font()};font-size:13px;'
        f'color:{BEIGE};margin-bottom:12px;font-weight:600;">{escape(title)}</div>'
        f'<ol style="font-family:{_font()};color:#ffffff;'
        f'font-size:13px;line-height:1.85;margin:0;padding-left:18px;">{items}</ol></div>'
    )


def _help_footer(lang: str) -> str:
    if lang == "en":
        return _paragraph(
            f'Need help? Reply to this email or write to '
            f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{TEAL};text-decoration:none;">'
            f'{SUPPORT_EMAIL}</a>. Thank you for trusting HeyMaa! 🌸'
        )
    return _paragraph(
        f'Αν χρειαστείς βοήθεια, απάντησε σε αυτό το email ή γράψε στο '
        f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{TEAL};text-decoration:none;">'
        f'{SUPPORT_EMAIL}</a>.<br>Σε ευχαριστούμε που μας εμπιστεύεσαι! 🌸'
    )


def render_beta_invite_email(
    *,
    first_name: str,
    email: str,
    invite_code: str,
    plan_label: str,
    app_url: str,
    auth_account_ready: bool = False,
    temporary_password: Optional[str] = None,
) -> EmailMessage:
    greet_name = escape(greek_vocative(first_name))
    if auth_account_ready and temporary_password:
        login_steps = [
            f'Βάλε το email σου: <strong>{escape(email)}</strong>',
            f'Προσωρινός κωδικός: <strong>{escape(temporary_password)}</strong>',
            "Σύνδεση — θα σου ζητηθεί να ορίσεις <strong>νέο κωδικό</strong> στην πρώτη είσοδο",
        ]
    elif auth_account_ready:
        login_steps = [
            f'Βάλε το email σου: <strong>{escape(email)}</strong>',
            'Πάτα <strong>«Ξέχασα τον κωδικό»</strong> για να ορίσεις password',
            "Άνοιξε το link από το email επαναφοράς και όρισε κωδικό",
            "Σύνδεση με email + password",
        ]
    else:
        login_steps = [
            f'Βάλε το email σου: <strong>{escape(email)}</strong>',
            "Βάλε τον κωδικό πρόσκλησης",
            "Φτιάξε τον κωδικό σου (password)",
        ]

    body = (
        f'<p style="font-family:{_font()};font-size:22px;font-weight:700;color:{TEXT};'
        f'line-height:1.35;margin:0 0 16px;text-align:center;">'
        f'Γεια σου <strong>{greet_name}</strong>! 👋</p>'
        + _paragraph(
            f'Σε καλωσορίζουμε στο <strong style="color:{TEXT};">HeyMaa Beta</strong>! '
            f'Είσαι ένας από τους πρώτους ανθρώπους που θα δοκιμάσουν την εφαρμογή μας. '
            f'Ο λογαριασμός σου έχει ρυθμιστεί στο πακέτο <strong style="color:{TEXT};">'
            f'{escape(plan_label)}</strong>.'
        )
        + _code_box("Κωδικός Πρόσκλησης", invite_code)
        + _steps_panel(
            "📱 Οδηγίες Εισόδου",
            [
                'Άνοιξε το app <strong>από κινητό</strong> σε <strong>incognito mode</strong>',
                f'Επισκέψου: <a href="{escape(app_url, quote=True)}" style="color:{TEAL};text-decoration:none;">{escape(app_url)}</a>',
                *login_steps,
            ],
        )
        + _help_footer("el")
    )
    return EmailMessage(
        subject=f"Πρόσκληση Beta — HeyMaa {plan_label} | Κωδικός: {invite_code}",
        html=_email_shell(body, preheader=f"Ο κωδικός πρόσκλησής σου: {invite_code}"),
    )


def render_password_reset_email(
    *,
    name: Optional[str],
    reset_url: str,
    lang: str = "el",
    expires_hours: int = 2,
    app_url: Optional[str] = None,
) -> EmailMessage:
    del app_url  # logo is embedded; kept for API compatibility
    lang = normalize_email_lang(lang)
    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                "We received a request to reset your HeyMaa password. "
                f"The link below is valid for <strong style=\"color:{TEXT};\">{expires_hours} hours</strong>."
            )
            + _button(reset_url, "Reset password")
            + _paragraph(
                f'If the button does not work, copy this link:<br>'
                f'<a href="{escape(reset_url, quote=True)}" style="color:{TEAL};word-break:break-all;text-decoration:none;">'
                f"{escape(reset_url)}</a>"
            )
            + _paragraph(
                "If you did not request this, you can safely ignore this email — "
                "your password will stay the same."
            )
            + _help_footer(lang)
        )
        subject = "Reset your HeyMaa password"
        preheader = "Password reset link for your HeyMaa account"
    else:
        body = (
            _greeting(name, lang)
            + _paragraph(
                "Λάβαμε αίτημα επαναφοράς κωδικού για τον λογαριασμό σου στην HeyMaa. "
                f"Το link ισχύει για <strong style=\"color:{TEXT};\">{expires_hours} ώρες</strong>."
            )
            + _button(reset_url, "Επαναφορά κωδικού")
            + _paragraph(
                f'Αν το κουμπί δεν λειτουργεί, αντέγραψε αυτό το link:<br>'
                f'<a href="{escape(reset_url, quote=True)}" style="color:{TEAL};word-break:break-all;text-decoration:none;">'
                f"{escape(reset_url)}</a>"
            )
            + _paragraph(
                "Αν δεν ζήτησες εσύ επαναφορά, αγνόησε αυτό το email — "
                "ο κωδικός σου δεν θα αλλάξει."
            )
            + _help_footer(lang)
        )
        subject = "Επαναφορά κωδικού HeyMaa"
        preheader = "Link επαναφοράς κωδικού για τον λογαριασμό σου"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def render_welcome_trial_email(
    *,
    name: Optional[str],
    app_url: str,
    trial_days: int,
    lang: str = "el",
) -> EmailMessage:
    lang = normalize_email_lang(lang)
    plan = _plan_label("trial", lang)
    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Welcome to <strong style=\"color:{TEXT};\">HeyMaa</strong>! Your account is ready with a "
                f"<strong style=\"color:{TEXT};\">{trial_days}-day free trial</strong> ({plan})."
            )
            + _paragraph(
                "Open the app to chat with HeyMaa, track milestones, save memories, "
                "and explore tips for pregnancy and parenthood."
            )
            + _button(app_url, "Open HeyMaa")
            + _help_footer(lang)
        )
        subject = "Welcome to HeyMaa!"
        preheader = f"Your {trial_days}-day free trial has started"
    else:
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Καλώς ήρθες στην <strong style=\"color:{TEXT};\">HeyMaa</strong>! Ο λογαριασμός σου είναι έτοιμος με "
                f"<strong style=\"color:{TEXT};\">{trial_days} ημέρες δωρεάν δοκιμή</strong> ({plan})."
            )
            + _paragraph(
                "Άνοιξε την εφαρμογή για να μιλήσεις με την HeyMaa, να καταγράφεις ορόσημα, "
                "να αποθηκεύεις αναμνήσεις και να βρίσκεις συμβουλές για εγκυμοσύνη και γονεϊκότητα."
            )
            + _button(app_url, "Άνοιξε την HeyMaa")
            + _help_footer(lang)
        )
        subject = "Καλώς ήρθες στην HeyMaa!"
        preheader = f"Ξεκίνησε η δωρεάν δοκιμή {trial_days} ημερών"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def render_subscription_activated_email(
    *,
    name: Optional[str],
    plan: str,
    app_url: str,
    lang: str = "el",
) -> EmailMessage:
    lang = normalize_email_lang(lang)
    plan_label = _plan_label(plan, lang)
    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Thank you! Your HeyMaa subscription is now active: "
                f"<strong style=\"color:{TEXT};\">{escape(plan_label)}</strong>."
            )
            + _paragraph(
                "You can continue using all features without interruption. "
                "Open the app to pick up where you left off."
            )
            + _button(app_url, "Continue to HeyMaa")
            + _help_footer(lang)
        )
        subject = "Your HeyMaa subscription is active"
        preheader = f"Subscription activated: {plan_label}"
    else:
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Ευχαριστούμε! Η συνδρομή σου στην HeyMaa είναι πλέον ενεργή: "
                f"<strong style=\"color:{TEXT};\">{escape(plan_label)}</strong>."
            )
            + _paragraph(
                "Μπορείς να συνεχίσεις να χρησιμοποιείς όλες τις δυνατότητες χωρίς διακοπή. "
                "Άνοιξε την εφαρμογή για να συνεχίσεις από εκεί που έμεινες."
            )
            + _button(app_url, "Συνέχεια στην HeyMaa")
            + _help_footer(lang)
        )
        subject = "Η συνδρομή σου στην HeyMaa ενεργοποιήθηκε"
        preheader = f"Ενεργή συνδρομή: {plan_label}"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def render_subscription_welcome_email(
    *,
    name: Optional[str],
    plan: str,
    invite_code: str,
    app_url: str,
    lang: str = "el",
) -> EmailMessage:
    """Post-checkout welcome for purchasers who still need to register (e.g. Lemon Squeezy)."""
    lang = normalize_email_lang(lang)
    plan_label = _plan_label(plan, lang)
    signup_url = f"{app_url.rstrip('/')}?invite={invite_code}"
    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Thank you for your purchase! Your <strong style=\"color:{TEXT};\">{escape(plan_label)}</strong> "
                f"plan is ready — use the invite code below to create your HeyMaa account."
            )
            + _code_box("Invite code", invite_code)
            + _steps_panel(
                "Getting started",
                [
                    f'Open <a href="{escape(signup_url, quote=True)}" style="color:{TEAL};text-decoration:none;">HeyMaa</a> on your phone',
                    "Sign up with the same email you used for payment",
                    f"Enter invite code: <strong>{escape(invite_code)}</strong>",
                    "Set your password and complete your profile",
                ],
            )
            + _button(signup_url, "Start HeyMaa")
            + _help_footer(lang)
        )
        subject = "Welcome to HeyMaa — your subscription is ready"
        preheader = f"Invite code: {invite_code}"
    else:
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Ευχαριστούμε για την αγορά σου! Το πακέτο <strong style=\"color:{TEXT};\">{escape(plan_label)}</strong> "
                f"είναι έτοιμο — χρησιμοποίησε τον κωδικό πρόσκλησης παρακάτω για να δημιουργήσεις λογαριασμό HeyMaa."
            )
            + _code_box("Κωδικός πρόσκλησης", invite_code)
            + _steps_panel(
                "📱 Πρώτα βήματα",
                [
                    f'Άνοιξε την <a href="{escape(signup_url, quote=True)}" style="color:{TEAL};text-decoration:none;">HeyMaa</a> από κινητό',
                    "Εγγράψου με το ίδιο email που χρησιμοποίησες στην πληρωμή",
                    f"Βάλε τον κωδικό πρόσκλησης: <strong>{escape(invite_code)}</strong>",
                    "Όρισε κωδικό και ολοκλήρωσε το προφίλ σου",
                ],
            )
            + _button(signup_url, "Ξεκίνα την HeyMaa")
            + _help_footer(lang)
        )
        subject = "Καλώς ήρθες στην HeyMaa — η συνδρομή σου είναι έτοιμη"
        preheader = f"Κωδικός πρόσκλησης: {invite_code}"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def render_password_changed_email(
    *,
    name: Optional[str],
    app_url: str,
    lang: str = "el",
) -> EmailMessage:
    lang = normalize_email_lang(lang)
    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                "This is a confirmation that your HeyMaa password was changed successfully."
            )
            + _paragraph(
                "If you did not make this change, contact us immediately at "
                f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{TEAL};text-decoration:none;">{SUPPORT_EMAIL}</a>.'
            )
            + _button(app_url, "Open HeyMaa")
            + _help_footer(lang)
        )
        subject = "Your HeyMaa password was changed"
        preheader = "Password change confirmation"
    else:
        body = (
            _greeting(name, lang)
            + _paragraph(
                "Επιβεβαιώνουμε ότι ο κωδικός σου στην HeyMaa άλλαξε με επιτυχία."
            )
            + _paragraph(
                "Αν δεν έκανες εσύ αυτή την αλλαγή, επικοινώνησε αμέσως μαζί μας στο "
                f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{TEAL};text-decoration:none;">{SUPPORT_EMAIL}</a>.'
            )
            + _button(app_url, "Άνοιξε την HeyMaa")
            + _help_footer(lang)
        )
        subject = "Ο κωδικός σου στην HeyMaa άλλαξε"
        preheader = "Επιβεβαίωση αλλαγής κωδικού"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def render_access_expiry_reminder_email(
    *,
    name: Optional[str],
    access_ends_at: str,
    app_url: str,
    lang: str = "el",
) -> EmailMessage:
    lang = normalize_email_lang(lang)
    try:
        end_dt = datetime.fromisoformat(access_ends_at.replace("Z", "+00:00"))
        if lang == "en":
            end_label = end_dt.strftime("%d %B %Y")
        else:
            end_label = end_dt.strftime("%d/%m/%Y")
    except Exception:
        end_label = access_ends_at[:10]

    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Your HeyMaa access ends soon — on <strong style=\"color:{TEXT};\">{escape(end_label)}</strong>."
            )
            + _paragraph(
                "Renew or upgrade your plan now so you don't lose chat, memories, and milestones."
            )
            + _button(f"{app_url.rstrip('/')}/app", "Renew or upgrade")
            + _help_footer(lang)
        )
        subject = "Your HeyMaa access ends in 2 days"
        preheader = f"Access ends {end_label}"
    else:
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Η πρόσβασή σου στην HeyMaa λήγει σύντομα — στις "
                f"<strong style=\"color:{TEXT};\">{escape(end_label)}</strong>."
            )
            + _paragraph(
                "Ανανέωσε ή αναβάθμισε το πακέτο σου τώρα, για να μη χάσεις chat, αναμνήσεις και ορόσημα."
            )
            + _button(f"{app_url.rstrip('/')}/app", "Ανανέωση / Upgrade")
            + _help_footer(lang)
        )
        subject = "Η πρόσβασή σου στην HeyMaa λήγει σε 2 ημέρες"
        preheader = f"Λήξη πρόσβασης {end_label}"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def _format_email_date(value: Optional[str], lang: str) -> str:
    if not value:
        return ""
    try:
        end_dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if lang == "en":
            return end_dt.strftime("%d %B %Y")
        return end_dt.strftime("%d/%m/%Y")
    except Exception:
        return str(value)[:10]


def _gift_line(days: int, plan_slot: str, lang: str) -> str:
    plan = _gift_plan_name(plan_slot, lang)
    if lang == "en":
        unit = "day" if days == 1 else "days"
        return f"{days} {unit} free {plan}"
    unit = "μέρα" if days == 1 else "μέρες"
    return f"{days} {unit} δωρεάν {plan}"


def render_level_gift_won_email(
    *,
    name: Optional[str],
    gifts: list[dict],
    level_name: Optional[str],
    app_url: str,
    lang: str = "el",
) -> EmailMessage:
    lang = normalize_email_lang(lang)
    app_href = f"{app_url.rstrip('/')}/app"
    lines = []
    for gift in gifts:
        days = int(gift.get("days") or 0)
        slot = str(gift.get("plan_slot") or "starter")
        gift_name = str(gift.get("level_name") or "").strip()
        desc = _gift_line(days, slot, lang)
        if gift_name:
            lines.append(f"{escape(gift_name)} — {escape(desc)}")
        else:
            lines.append(escape(desc))
    gifts_html = "".join(
        f'<li style="margin-bottom:8px;">{line}</li>' for line in lines
    ) or f'<li style="margin-bottom:8px;">{escape(_gift_line(0, "starter", lang))}</li>'
    reached = escape((level_name or "").strip())

    if lang == "en":
        reached_bit = (
            f' You reached <strong style="color:{TEXT};">{reached}</strong>.'
            if reached
            else ""
        )
        body = (
            _greeting(name, lang)
            + _paragraph(f"You leveled up!{reached_bit} A HeyMaa gift is waiting for you:")
            + (
                f'<ul style="font-family:{_font()};color:{TEXT};font-size:15px;'
                f'line-height:1.65;margin:0 0 16px;padding-left:20px;">{gifts_html}</ul>'
            )
            + _paragraph(
                'Open the app and tap <strong style="color:{TEXT};">Claim your gift!</strong> '
                "to activate the extra days — they are not applied until you claim."
            )
            + _button(app_href, "Claim your gift")
            + _help_footer(lang)
        )
        subject = "You unlocked a HeyMaa gift"
        preheader = "A level reward is waiting in the app"
    else:
        reached_bit = (
            f' Έφτασες το επίπεδο <strong style="color:{TEXT};">{reached}</strong>.'
            if reached
            else ""
        )
        body = (
            _greeting(name, lang)
            + _paragraph(f"Ανέβηκες επίπεδο!{reached_bit} Σε περιμένει ένα δώρο HeyMaa:")
            + (
                f'<ul style="font-family:{_font()};color:{TEXT};font-size:15px;'
                f'line-height:1.65;margin:0 0 16px;padding-left:20px;">{gifts_html}</ul>'
            )
            + _paragraph(
                'Άνοιξε την εφαρμογή και πάτα <strong style="color:{TEXT};">Πάρε το δώρο σου!</strong> '
                "για να ενεργοποιήσεις τις επιπλέον μέρες — δεν προστίθενται μόνες τους."
            )
            + _button(app_href, "Πάρε το δώρο σου")
            + _help_footer(lang)
        )
        subject = "Ξεκλείδωσες ένα δώρο HeyMaa"
        preheader = "Ένα δώρο επιπέδου σε περιμένει στην εφαρμογή"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def render_level_gift_activated_email(
    *,
    name: Optional[str],
    days: int,
    plan_slot: str,
    level_name: Optional[str] = None,
    upgraded: bool = False,
    starts_at: Optional[str] = None,
    ends_at: Optional[str] = None,
    app_url: str,
    lang: str = "el",
) -> EmailMessage:
    lang = normalize_email_lang(lang)
    app_href = f"{app_url.rstrip('/')}/app"
    gift = _gift_line(int(days or 0), plan_slot, lang)
    start_label = _format_email_date(starts_at, lang)
    end_label = _format_email_date(ends_at, lang)
    level_bit = escape((level_name or "").strip())

    if lang == "en":
        timing = ""
        if upgraded:
            timing = (
                "Matched to your current plan — not a downgrade. "
                "The extra days start after your current access ends."
            )
        elif start_label and end_label:
            timing = f"They start on {start_label} and last until {end_label}."
        elif end_label:
            timing = f"They are active until {end_label}."
        level_intro = (
            f' Your <strong style="color:{TEXT};">{level_bit}</strong> gift is now active: '
            if level_bit
            else " Your level gift is now active: "
        )
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Done!{level_intro}"
                f"<strong style=\"color:{TEXT};\">{escape(gift)}</strong>."
            )
            + (_paragraph(timing) if timing else "")
            + _button(app_href, "Open HeyMaa")
            + _help_footer(lang)
        )
        subject = "Your HeyMaa gift is active"
        preheader = gift
    else:
        timing = ""
        if upgraded:
            timing = (
                "Ισοδυναμεί με το τρέχον πλάνο σου — χωρίς υποβάθμιση. "
                "Οι επιπλέον μέρες ξεκινούν μετά τη λήξη της τρέχουσας πρόσβασής σου."
            )
        elif start_label and end_label:
            timing = f"Ξεκινά στις {start_label} και ισχύει μέχρι {end_label}."
        elif end_label:
            timing = f"Είναι ενεργό μέχρι {end_label}."
        level_intro = (
            f' Το δώρο για το επίπεδο <strong style="color:{TEXT};">{level_bit}</strong> ενεργοποιήθηκε: '
            if level_bit
            else " Το δώρο επιπέδου ενεργοποιήθηκε: "
        )
        body = (
            _greeting(name, lang)
            + _paragraph(
                f"Τέλεια!{level_intro}"
                f"<strong style=\"color:{TEXT};\">{escape(gift)}</strong>."
            )
            + (_paragraph(timing) if timing else "")
            + _button(app_href, "Άνοιξε την HeyMaa")
            + _help_footer(lang)
        )
        subject = "Το δώρο σου στην HeyMaa ενεργοποιήθηκε"
        preheader = gift
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def render_llm_ops_alert_email(
    *,
    name: Optional[str],
    kind: str,
    remaining_usd: Optional[float],
    spent_usd: float,
    threshold_usd: Optional[float],
    day_cost_usd: float,
    last_error: str = "",
    billing_url: str,
    admin_url: str,
    key_mask: str = "",
    key_source: str = "",
    lang: str = "el",
) -> EmailMessage:
    lang = normalize_email_lang(lang)
    remaining_label = "—" if remaining_usd is None else f"${remaining_usd:.2f}"
    spent_label = f"${spent_usd:.2f}"
    day_label = f"${day_cost_usd:.2f}"
    threshold_label = "—" if threshold_usd is None else f"${threshold_usd:.2f}"
    key_line = ""
    if key_mask:
        src = f" ({escape(key_source)})" if key_source else ""
        key_line = f"<strong>HeyMaa Replicate key:</strong> {escape(key_mask)}{src}<br>"
    titles = {
        "credit_exhausted": (
            "Replicate: τα credits τελείωσαν",
            "Replicate credits ran out",
        ),
        "low_balance": (
            "Replicate: χρειάζεται reload credits",
            "Replicate: reload credits soon",
        ),
        "daily_budget": (
            "HeyMaa: ημερήσιο όριο κόστους LLM",
            "HeyMaa: daily LLM spend limit reached",
        ),
        "monthly_budget": (
            "HeyMaa: μηνιαίο όριο κόστους LLM",
            "HeyMaa: monthly LLM spend limit reached",
        ),
    }
    pair = titles.get(kind) or titles["low_balance"]
    subject = pair[1 if lang == "en" else 0]
    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                "HeyMaa chat bills a dedicated Replicate account. When that prepaid "
                "balance hits zero, Replicate stops new predictions."
            )
            + _paragraph(
                f"{key_line}"
                f"<strong>Estimated HeyMaa remaining:</strong> {remaining_label}<br>"
                f"<strong>Spend since last sync:</strong> {spent_label}<br>"
                f"<strong>Reload alert below:</strong> {threshold_label}<br>"
                f"<strong>Spend today:</strong> {day_label}"
            )
            + (
                _paragraph(f"Last provider error: {escape(last_error)}")
                if last_error
                else ""
            )
            + _paragraph(
                "Top up or enable auto reload in Replicate Billing, then paste the new "
                "prepaid remaining in Admin → Overview."
            )
            + _button(billing_url, "Open Replicate billing")
            + _button(admin_url, "Open HeyMaa admin")
            + _help_footer(lang)
        )
        preheader = f"LLM credits {remaining_label} remaining"
    else:
        body = (
            _greeting(name, lang)
            + _paragraph(
                "Το chat της HeyMaa χρεώνει έναν dedicated λογαριασμό Replicate. "
                "Όταν το prepaid υπόλοιπο φτάσει στο μηδέν, το Replicate σταματά νέα predictions."
            )
            + _paragraph(
                f"{key_line}"
                f"<strong>Εκτιμώμενο υπόλοιπο HeyMaa:</strong> {remaining_label}<br>"
                f"<strong>Κόστος από το τελευταίο sync:</strong> {spent_label}<br>"
                f"<strong>Ειδοποίηση reload κάτω από:</strong> {threshold_label}<br>"
                f"<strong>Κόστος σήμερα:</strong> {day_label}"
            )
            + (
                _paragraph(f"Τελευταίο σφάλμα παρόχου: {escape(last_error)}")
                if last_error
                else ""
            )
            + _paragraph(
                "Πρόσθεσε credit ή άνοιξε auto reload στο Replicate Billing, "
                "και πέρασε το νέο prepaid υπόλοιπο στο Admin → Overview."
            )
            + _button(billing_url, "Άνοιξε Replicate Billing")
            + _button(admin_url, "Άνοιξε το HeyMaa admin")
            + _help_footer(lang)
        )
        preheader = f"Credits LLM {remaining_label}"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def _fmt_int(n: Any) -> str:
    try:
        return f"{int(n):,}".replace(",", ".")
    except (TypeError, ValueError):
        return "0"


def _fmt_eur(n: Any) -> str:
    try:
        return f"€{float(n):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return "€0,00"


def _fmt_usd(n: Any) -> str:
    try:
        return f"${float(n):,.2f}"
    except (TypeError, ValueError):
        return "$0.00"


def _fmt_pct(n: Any) -> str:
    try:
        return f"{float(n):.1f}%"
    except (TypeError, ValueError):
        return "0.0%"


def _report_shell(body_html: str, *, preheader: str = "") -> str:
    """Full-bleed visual shell for the admin daily pulse (wider than transactional)."""
    preheader_html = ""
    if preheader:
        preheader_html = (
            f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
            f"{escape(preheader)}</div>"
        )
    font = _font()
    logo = escape(_hosted_logo_src(), quote=True)
    # Deep navy atmosphere — not flat cream, not purple-AI
    bg = "#151B2E"
    return f"""<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:{bg};">
{preheader_html}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{bg};">
  <tr>
    <td align="center" style="padding:28px 12px 40px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;">
        <tr><td>{body_html}</td></tr>
        <tr>
          <td align="center" style="padding:22px 8px 0;">
            <img src="{logo}" width="28" height="28" alt="HeyMaa"
              style="display:inline-block;width:28px;height:28px;border-radius:50%;border:0;vertical-align:middle;margin-right:8px;" />
            <span style="font-family:{font};font-size:11px;color:rgba(245,240,235,0.45);line-height:28px;vertical-align:middle;">
              HeyMaa Pulse · Care Direct · {escape(SUPPORT_EMAIL)}
            </span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>"""


def _spark_bars(values: list, *, color: str = TEAL, height: int = 36) -> str:
    """Email-safe mini bar chart from numeric series."""
    nums = [max(0.0, float(v or 0)) for v in (values or [])][-7:]
    while len(nums) < 7:
        nums.insert(0, 0.0)
    peak = max(nums) if nums else 0.0
    cells = []
    for i, v in enumerate(nums):
        h = 4 if peak <= 0 else max(4, int(round((v / peak) * height)))
        pad = height - h
        # Last bar slightly brighter
        bar_color = "#7AD9C8" if i == len(nums) - 1 else color
        cells.append(
            f'<td valign="bottom" width="14%" align="center" style="padding:0 2px;">'
            f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0">'
            f'<tr><td height="{pad}" style="font-size:0;line-height:0;">&nbsp;</td></tr>'
            f'<tr><td height="{h}" bgcolor="{bar_color}" style="background:{bar_color};'
            f'border-radius:3px 3px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>'
            f'</table></td>'
        )
    return (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        f'style="height:{height}px;"><tr>{"".join(cells)}</tr></table>'
    )


def _rate_bar(pct: Any, *, label: str, color: str = TEAL) -> str:
    try:
        p = max(0.0, min(100.0, float(pct or 0)))
    except (TypeError, ValueError):
        p = 0.0
    filled = max(0, min(100, int(round(p))))
    empty = 100 - filled
    font = _font()
    fill_td = (
        f'<td width="{filled}%" bgcolor="{color}" style="background:{color};'
        f'height:10px;font-size:0;line-height:0;border-radius:999px 0 0 999px;">&nbsp;</td>'
        if filled
        else ""
    )
    empty_td = (
        f'<td width="{empty}%" bgcolor="rgba(43,58,103,0.10)" '
        f'style="background:rgba(43,58,103,0.10);height:10px;font-size:0;line-height:0;'
        f'border-radius:{"999px" if not filled else "0 999px 999px 0"};">&nbsp;</td>'
        if empty
        else ""
    )
    return (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px;">'
        f'<tr><td style="font-family:{font};font-size:12px;color:{TEXT_SOFT};padding:0 0 6px;">'
        f'{escape(label)}'
        f'<span style="float:right;font-weight:700;color:{TEXT};">{_fmt_pct(p)}</span></td></tr>'
        f'<tr><td>'
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        f'style="border-radius:999px;overflow:hidden;"><tr>{fill_td}{empty_td}</tr></table>'
        f'</td></tr></table>'
    )


def _kpi_tile(label: str, value: str, *, hint: str = "", accent: str = TEAL) -> str:
    font = _font()
    hint_html = (
        f'<div style="font-family:{font};font-size:11px;color:{MUTED};margin-top:6px;">{escape(hint)}</div>'
        if hint
        else ""
    )
    return (
        f'<td width="50%" valign="top" style="padding:6px;">'
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        f'style="background:#ffffff;border-radius:16px;border:1px solid {BORDER};">'
        f'<tr><td style="padding:16px 16px 14px;border-top:3px solid {accent};border-radius:16px;">'
        f'<div style="font-family:{font};font-size:11px;font-weight:700;letter-spacing:0.6px;'
        f'text-transform:uppercase;color:{MUTED};">{escape(label)}</div>'
        f'<div style="font-family:{font};font-size:28px;font-weight:700;color:{NAVY};'
        f'line-height:1.15;margin-top:6px;">{escape(value)}</div>'
        f'{hint_html}</td></tr></table></td>'
    )


def _section_panel(title: str, body: str, *, accent: str = TEAL, eyebrow: str = "") -> str:
    font = _font()
    eye = (
        f'<div style="font-family:{font};font-size:11px;font-weight:700;letter-spacing:1px;'
        f'text-transform:uppercase;color:{accent};margin:0 0 4px;">{escape(eyebrow)}</div>'
        if eyebrow
        else ""
    )
    return (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        f'style="margin:0 0 16px;background:#ffffff;border-radius:18px;border:1px solid {BORDER};">'
        f'<tr><td style="padding:20px 20px 8px;border-left:4px solid {accent};">'
        f'{eye}'
        f'<div style="font-family:{font};font-size:18px;font-weight:700;color:{NAVY};margin:0 0 14px;">'
        f'{escape(title)}</div>{body}</td></tr></table>'
    )


def _pair_rows(rows: list[tuple[str, str]]) -> str:
    font = _font()
    out = []
    for label, value in rows:
        out.append(
            f'<tr>'
            f'<td style="font-family:{font};font-size:13px;color:{TEXT_SOFT};padding:7px 0;'
            f'border-bottom:1px solid {BORDER};">{escape(label)}</td>'
            f'<td align="right" style="font-family:{font};font-size:13px;font-weight:700;'
            f'color:{NAVY};padding:7px 0;border-bottom:1px solid {BORDER};white-space:nowrap;">'
            f'{escape(value)}</td></tr>'
        )
    return f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0">{"".join(out)}</table>'


def _alert_ribbon(items: list[str], *, lang: str) -> str:
    if not items:
        return ""
    font = _font()
    title = "Needs attention" if lang == "en" else "Χρειάζεται προσοχή"
    chips = "".join(
        f'<div style="font-family:{font};font-size:13px;color:#5C3A1A;background:#FFF4E8;'
        f'border:1px solid #F0D2B0;border-radius:999px;padding:8px 14px;margin:0 6px 8px 0;'
        f'display:inline-block;">{escape(item)}</div>'
        for item in items
    )
    return (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        f'style="margin:0 0 16px;background:linear-gradient(135deg,#FFF8F0,#FFE8D2);'
        f'border-radius:18px;border:1px solid #F0D2B0;">'
        f'<tr><td style="padding:16px 18px;">'
        f'<div style="font-family:{font};font-size:12px;font-weight:700;letter-spacing:0.8px;'
        f'text-transform:uppercase;color:#A65C18;margin:0 0 10px;">{escape(title)}</div>'
        f'{chips}</td></tr></table>'
    )


def _eng_compact(block: dict, *, lang: str) -> str:
    b = block or {}
    rows = [
        ("Sent" if lang == "en" else "Απεσταλμένα", _fmt_int(b.get("sent"))),
        ("Opens", f"{_fmt_int(b.get('unique_opens'))} · {_fmt_pct(b.get('open_rate'))}"),
        ("Clicks", f"{_fmt_int(b.get('unique_clicks'))} · {_fmt_pct(b.get('click_rate'))}"),
        ("Bounce", f"{_fmt_int(b.get('bounced'))} · {_fmt_pct(b.get('bounce_rate'))}"),
        ("Spam", f"{_fmt_int(b.get('complained'))} · {_fmt_pct(b.get('complaint_rate'))}"),
    ]
    return _pair_rows(rows)


def render_admin_daily_report_email(
    *,
    name: Optional[str],
    report: dict,
    admin_url: str,
    lang: str = "el",
) -> EmailMessage:
    """Cinematic daily pulse email — scoreboard, sparklines, rate bars, attention strip."""
    lang = normalize_email_lang(lang)
    date_label = str(report.get("report_date") or datetime.utcnow().date().isoformat())
    h = report.get("headline") or {}
    cum = report.get("cumulative") or {}
    rev = report.get("revenue") or {}
    funnel = report.get("funnel") or {}
    msg = report.get("messaging") or {}
    email = report.get("email") or {}
    ops = report.get("ops") or {}
    plans = report.get("plans") or []
    sparks = report.get("sparks") or {}
    acq = report.get("acquisition") or {}

    mkt_today = email.get("marketing_today") or {}
    mkt_all = email.get("marketing_all") or {}
    drip_today = email.get("drip_today") or {}
    drip_all = email.get("drip_all") or {}
    camp_today = email.get("campaign_today") or {}
    camp_all = email.get("campaign_all") or {}

    font = _font()
    # Hosted URL + CID both work; hosted is primary so the mark always paints in inbox.
    logo_hosted = escape(_hosted_logo_src(), quote=True)
    logo_cid = escape(f"cid:{LOGO_CID}", quote=True) if logo_attachment() else logo_hosted
    who = escape(_display_name(name, lang))

    if lang == "en":
        subject = f"HeyMaa Pulse · {date_label}"
        hero_kicker = "Daily Pulse"
        hero_title = f"Good morning, {who}"
        hero_sub = "Growth, money, campaigns (Moosend/Meta), and what needs you today."
        btn = "Open live Insights"
        lbl_signups, lbl_dau, lbl_cash, lbl_mrr = "Signups today", "DAU", "Cash today", "MRR"
        lbl_spark_users, lbl_spark_dau = "New users · 7 days", "Active users · 7 days"
        lbl_spark_cash, lbl_spark_llm = "Cash · 7 days", "LLM spend · 7 days"
        sec_cum = "Cumulative picture"
        sec_mkt = "Marketing engine"
        sec_list = "List health"
        sec_acq = "Acquisition · what works"
        sec_drip = "Conversion drips"
        sec_ops = "Ops & support"
        sec_plans = "Plan mix"
        open_label = "Marketing open rate (today)"
        consent_label = "Marketing consent rate"
        click_label = "Marketing click rate (today)"
    else:
        subject = f"HeyMaa Pulse · {date_label}"
        hero_kicker = "Ημερήσιος παλμός"
        hero_title = f"Καλημέρα, {who}"
        hero_sub = "Ανάπτυξη, έσοδα, campaigns (Moosend/Meta) και ό,τι σε χρειάζεται σήμερα."
        btn = "Άνοιξε live Insights"
        lbl_signups, lbl_dau, lbl_cash, lbl_mrr = "Εγγραφές σήμερα", "DAU", "Εισπράξεις σήμερα", "MRR"
        lbl_spark_users, lbl_spark_dau = "Νέοι χρήστες · 7ημ", "Ενεργοί · 7ημ"
        lbl_spark_cash, lbl_spark_llm = "Εισπράξεις · 7ημ", "Κόστος LLM · 7ημ"
        sec_cum = "Αθροιστική εικόνα"
        sec_mkt = "Marketing engine"
        sec_list = "Υγεία λίστας"
        sec_acq = "Acquisition · τι δουλεύει"
        sec_drip = "Conversion drips"
        sec_ops = "Ops & support"
        sec_plans = "Μίγμα πλάνων"
        open_label = "Open rate marketing (σήμερα)"
        consent_label = "Consent rate marketing"
        click_label = "Click rate marketing (σήμερα)"

    # Attention chips
    alerts: list[str] = []
    t48 = int(funnel.get("trials_ending_48h") or 0)
    fails = int(msg.get("drip_email_fail_24h") or 0)
    unsub = int(msg.get("marketing_unsubscribes_today") or 0)
    support_n = int(ops.get("support_pending_admin") or 0) + int(ops.get("support_open") or 0)
    cancels = int(rev.get("pending_cancels") or 0)
    if lang == "en":
        if t48:
            alerts.append(f"{t48} trials end ≤48h")
        if fails:
            alerts.append(f"{fails} drip email failures")
        if unsub:
            alerts.append(f"{unsub} unsubscribes today")
        if support_n:
            alerts.append(f"{support_n} support threads open")
        if cancels:
            alerts.append(f"{cancels} pending cancels")
    else:
        if t48:
            alerts.append(f"{t48} δοκιμές λήγουν ≤48ώ")
        if fails:
            alerts.append(f"{fails} αποτυχίες drip email")
        if unsub:
            alerts.append(f"{unsub} διαγραφές σήμερα")
        if support_n:
            alerts.append(f"{support_n} ανοιχτά support")
        if cancels:
            alerts.append(f"{cancels} εκκρεμείς ακυρώσεις")

    # Hero — brand logo is the first visual (hosted URL so Gmail always paints it)
    hero = f"""
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"
  style="background:linear-gradient(165deg,#1A2340 0%,#2B3A67 55%,#1F7A6C 140%);
  border-radius:22px 22px 0 0;overflow:hidden;">
  <tr>
    <td align="center" style="padding:32px 28px 10px;">
      <img src="{logo_hosted}" width="72" height="72" alt="HeyMaa"
        style="display:block;width:72px;height:72px;border-radius:50%;border:2px solid rgba(248,229,214,0.55);
        box-shadow:0 8px 28px rgba(0,0,0,0.28);margin:0 auto 14px;outline:none;" />
      <!--[if !mso]><!-->
      <div style="display:none;max-height:0;overflow:hidden;">
        <img src="{logo_cid}" width="1" height="1" alt="" />
      </div>
      <!--<![endif]-->
      <div style="font-family:{font};font-size:28px;font-weight:700;color:#ffffff;line-height:1;margin:0 0 6px;">
        Hey<span style="color:{PEACH};">Maa</span>
      </div>
      <div style="font-family:{font};font-size:11px;font-weight:700;letter-spacing:1.6px;
        text-transform:uppercase;color:rgba(255,255,255,0.55);margin:0 0 4px;">
        {escape(hero_kicker)}
      </div>
      <div style="font-family:{font};font-size:12px;font-weight:600;color:rgba(255,255,255,0.65);">
        {escape(date_label)}
      </div>
      <div style="height:3px;width:48px;background:{PEACH};border-radius:999px;margin:18px auto 16px;"></div>
      <div style="font-family:{font};font-size:24px;font-weight:700;color:#ffffff;
        line-height:1.3;margin:0 0 8px;">{hero_title}</div>
      <div style="font-family:{font};font-size:14px;color:rgba(255,255,255,0.72);
        line-height:1.55;max-width:420px;margin:0 auto;">{escape(hero_sub)}</div>
    </td>
  </tr>
  <tr><td style="height:18px;font-size:0;line-height:0;">&nbsp;</td></tr>
</table>
"""

    # Scoreboard on soft cream panel
    scoreboard = f"""
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"
  style="background:{CREAM};">
  <tr><td style="padding:8px 10px 4px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        {_kpi_tile(lbl_signups, _fmt_int(h.get("new_users_today")), hint=f"7d {_fmt_int(h.get('new_users_7d'))}", accent=TEAL)}
        {_kpi_tile(lbl_dau, _fmt_int(h.get("dau_today")), hint=f"7d {_fmt_int(h.get('active_last_7d'))}", accent="#5B7CFA")}
      </tr>
      <tr>
        {_kpi_tile(lbl_cash, _fmt_eur(rev.get("cash_today_eur")), hint=f"7d {_fmt_eur(rev.get('cash_7d_eur'))}", accent="#E8A87C")}
        {_kpi_tile(lbl_mrr, _fmt_eur(cum.get("recognized_mrr_eur")), hint=f"paying {_fmt_int(cum.get('paying_active'))}", accent="#C97B84")}
      </tr>
    </table>
  </td></tr>
</table>
"""

    sparks_panel = _section_panel(
        "7-day rhythm" if lang == "en" else "Ρυθμός 7 ημερών",
        f"""
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td width="50%" valign="top" style="padding:0 8px 16px 0;">
      <div style="font-family:{font};font-size:11px;font-weight:700;color:{MUTED};
        letter-spacing:0.4px;text-transform:uppercase;margin:0 0 8px;">{escape(lbl_spark_users)}</div>
      {_spark_bars(sparks.get("new_users_7d") or [], color=TEAL)}
    </td>
    <td width="50%" valign="top" style="padding:0 0 16px 8px;">
      <div style="font-family:{font};font-size:11px;font-weight:700;color:{MUTED};
        letter-spacing:0.4px;text-transform:uppercase;margin:0 0 8px;">{escape(lbl_spark_dau)}</div>
      {_spark_bars(sparks.get("dau_7d") or [], color="#5B7CFA")}
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top" style="padding:0 8px 4px 0;">
      <div style="font-family:{font};font-size:11px;font-weight:700;color:{MUTED};
        letter-spacing:0.4px;text-transform:uppercase;margin:0 0 8px;">{escape(lbl_spark_cash)}</div>
      {_spark_bars(sparks.get("cash_7d") or [], color="#E8A87C")}
    </td>
    <td width="50%" valign="top" style="padding:0 0 4px 8px;">
      <div style="font-family:{font};font-size:11px;font-weight:700;color:{MUTED};
        letter-spacing:0.4px;text-transform:uppercase;margin:0 0 8px;">{escape(lbl_spark_llm)}</div>
      {_spark_bars(sparks.get("llm_7d") or [], color="#C97B84")}
    </td>
  </tr>
</table>
""",
        accent="#5B7CFA",
        eyebrow="Trend" if lang == "en" else "Τάση",
    )

    cum_body = _pair_rows(
        [
            ("Total users" if lang == "en" else "Σύνολο χρηστών", _fmt_int(cum.get("total_users"))),
            ("Paying / trial / free", f"{_fmt_int(cum.get('paying_active'))} / {_fmt_int(cum.get('trial_active'))} / {_fmt_int(cum.get('free_plan_users'))}"),
            ("Cash lifetime", _fmt_eur(cum.get("cash_lifetime_eur"))),
            ("Orders lifetime", _fmt_int(cum.get("orders_lifetime"))),
            ("Chat · memories", f"{_fmt_int(cum.get('users_with_chat'))} · {_fmt_int(cum.get('total_memories'))}"),
            ("Gift claims", _fmt_int(cum.get("gift_claims_total"))),
            ("Drip enrollments", f"{_fmt_int(cum.get('drip_active_enrollments'))} active · {_fmt_int(cum.get('drip_enrolled_total'))} total"),
        ]
    )

    list_body = (
        _rate_bar(msg.get("marketing_consent_rate"), label=consent_label, color=TEAL)
        + _pair_rows(
            [
                ("Opted-in", _fmt_int(msg.get("marketing_consent_on"))),
                ("Opted-out", _fmt_int(msg.get("marketing_consent_off"))),
                ("Opt-ins today" if lang == "en" else "Opt-ins σήμερα", _fmt_int(msg.get("marketing_opt_ins_today"))),
                ("Unsubscribes today" if lang == "en" else "Διαγραφές σήμερα", _fmt_int(msg.get("marketing_unsubscribes_today"))),
                ("Push opt-in · devices", f"{_fmt_int(msg.get('push_opt_in'))} · {_fmt_int(msg.get('push_devices'))}"),
            ]
        )
    )

    mkt_body = (
        _rate_bar(mkt_today.get("open_rate"), label=open_label, color="#5B7CFA")
        + _rate_bar(mkt_today.get("click_rate"), label=click_label, color=TEAL)
        + f"""
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td width="50%" valign="top" style="padding:0 8px 0 0;">
      <div style="font-family:{font};font-size:12px;font-weight:700;color:{NAVY};margin:0 0 8px;">
        {"Today" if lang == "en" else "Σήμερα"}</div>
      {_eng_compact(mkt_today, lang=lang)}
    </td>
    <td width="50%" valign="top" style="padding:0 0 0 8px;">
      <div style="font-family:{font};font-size:12px;font-weight:700;color:{NAVY};margin:0 0 8px;">
        {"All-time" if lang == "en" else "Σύνολο"}</div>
      {_eng_compact(mkt_all, lang=lang)}
    </td>
  </tr>
</table>
"""
        + f"""
<div style="font-family:{font};font-size:12px;font-weight:700;color:{NAVY};margin:16px 0 8px;">
  {"Drips · campaigns" if lang == "en" else "Drips · campaigns"}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr>
    <td width="50%" valign="top" style="padding:0 8px 0 0;">
      <div style="font-family:{font};font-size:11px;color:{MUTED};margin:0 0 6px;">Drip today / all</div>
      {_pair_rows([
          ("Open today", f"{_fmt_pct(drip_today.get('open_rate'))}"),
          ("Open all", f"{_fmt_pct(drip_all.get('open_rate'))}"),
          ("Sent all", _fmt_int(drip_all.get("sent"))),
      ])}
    </td>
    <td width="50%" valign="top" style="padding:0 0 0 8px;">
      <div style="font-family:{font};font-size:11px;color:{MUTED};margin:0 0 6px;">Campaign today / all</div>
      {_pair_rows([
          ("Open today", f"{_fmt_pct(camp_today.get('open_rate'))}"),
          ("Open all", f"{_fmt_pct(camp_all.get('open_rate'))}"),
          ("Sent all", _fmt_int(camp_all.get("sent"))),
      ])}
    </td>
  </tr>
</table>
"""
    )

    drip_body = _pair_rows(
        [
            ("Active / completed / exited", f"{_fmt_int(msg.get('drip_active_enrollments'))} / {_fmt_int(msg.get('drip_completed_enrollments'))} / {_fmt_int(msg.get('drip_exited_enrollments'))}"),
            ("New enrollments today", _fmt_int(msg.get("drip_enrolled_today"))),
            ("Sends 24h (email OK / fail / push)", f"{_fmt_int(msg.get('drip_email_ok_24h'))} / {_fmt_int(msg.get('drip_email_fail_24h'))} / {_fmt_int(msg.get('drip_push_ok_24h'))}"),
            ("Sends all-time (email · push)", f"{_fmt_int(msg.get('drip_email_total'))} · {_fmt_int(msg.get('drip_push_total'))}"),
            ("Gift claims today · all", f"{_fmt_int(msg.get('gift_claims_today'))} · {_fmt_int(msg.get('gift_claims_total'))}"),
            ("Cash today · 30d", f"{_fmt_eur(rev.get('cash_today_eur'))} · {_fmt_eur(rev.get('cash_30d_eur'))}"),
            ("Pending cancels · trials ≤48h", f"{_fmt_int(rev.get('pending_cancels'))} · {_fmt_int(funnel.get('trials_ending_48h'))}"),
        ]
    )

    ops_body = _pair_rows(
        [
            ("LLM today", f"{_fmt_usd(ops.get('llm_cost_today_usd'))} · {_fmt_int(ops.get('llm_calls_today'))} calls"),
            ("LLM MTD · projected", f"{_fmt_usd(ops.get('llm_cost_mtd_usd'))} · {_fmt_usd(ops.get('projected_llm_month_usd'))}"),
            ("Near LLM limit", _fmt_int(ops.get("users_near_llm_limit"))),
            ("Support open · awaiting", f"{_fmt_int(ops.get('support_open'))} · {_fmt_int(ops.get('support_pending_admin'))}"),
        ]
    )

    # Acquisition / external campaigns (Moosend + Meta)
    acq_rows: list[tuple[str, str]] = [
        (
            "Window start" if lang == "en" else "Από",
            str(acq.get("window_start") or "2026-10-15"),
        ),
        (
            "Signups in window" if lang == "en" else "Εγγραφές στο παράθυρο",
            _fmt_int(acq.get("signups_in_window")),
        ),
        (
            "Attributed share" if lang == "en" else "Με attribution",
            _fmt_pct(acq.get("attributed_share_pct")),
        ),
        (
            "Unknown source share" if lang == "en" else "Άγνωστη πηγή",
            _fmt_pct(acq.get("unknown_share_pct")),
        ),
    ]
    for ch in (acq.get("by_channel") or [])[:6]:
        acq_rows.append(
            (
                f"Channel · {ch.get('channel')}",
                f"{_fmt_int(ch.get('signups'))} ({_fmt_pct(ch.get('share_pct'))})",
            )
        )
    ga4 = acq.get("ga4") or {}
    ga_traffic = ga4.get("traffic") or {}
    if ga_traffic.get("sessions"):
        acq_rows.append(
            (
                "GA4 · sessions / engaged",
                f"{_fmt_int(ga_traffic.get('sessions'))} / {_fmt_pct(ga_traffic.get('engagement_rate'))}",
            )
        )
        for gch in (ga_traffic.get("by_channel") or [])[:4]:
            acq_rows.append(
                (
                    f"GA4 · {gch.get('channel')}",
                    f"{_fmt_int(gch.get('sessions'))} ({_fmt_pct(gch.get('share_pct'))})",
                )
            )
    for camp in acq.get("campaigns") or []:
        provider = str(camp.get("provider") or camp.get("channel") or "?")
        f = camp.get("funnel") or {}
        if provider == "moosend":
            acq_rows.extend(
                [
                    (f"Moosend · recipients", _fmt_int(f.get("recipients"))),
                    (
                        "Moosend · open / click",
                        f"{_fmt_pct(f.get('open_rate'))} / {_fmt_pct(f.get('click_rate'))}",
                    ),
                    (
                        "Moosend · clicks → signup",
                        _fmt_pct(f.get("signup_from_click_pct"))
                        if f.get("signup_from_click_pct") is not None
                        else ("n/a until UTMs" if lang == "en" else "n/a μέχρι UTMs"),
                    ),
                    ("Moosend · unsub", f"{_fmt_int(f.get('unsubscribes'))} ({_fmt_pct(f.get('unsubscribe_rate'))})"),
                ]
            )
        elif provider == "meta":
            if f.get("incomplete"):
                acq_rows.append(
                    (
                        "Meta Ads",
                        "KPIs missing — fill Ads Manager" if lang == "en" else "Λείπουν KPIs — συμπλήρωσε Ads Manager",
                    )
                )
            else:
                acq_rows.extend(
                    [
                        ("Meta · impressions / clicks", f"{_fmt_int(f.get('impressions'))} / {_fmt_int(f.get('clicks'))}"),
                        ("Meta · spend", _fmt_eur(f.get("spend_eur"))),
                        ("Meta · attributed signups", _fmt_int(camp.get("matched_signups"))),
                    ]
                )
    insight_lines = list(acq.get("insights") or [])[:12]
    insight_html = ""
    if insight_lines:
        advice_label = "Advice · what to do next" if lang == "en" else "Συμβουλές · επόμενα βήματα"
        insight_html = (
            f'<div style="font-family:{font};font-size:11px;font-weight:700;letter-spacing:1.2px;'
            f'text-transform:uppercase;color:{TEAL};margin:16px 0 10px;">{escape(advice_label)}</div>'
        )
        for line in insight_lines:
            insight_html += (
                f'<div style="font-family:{font};font-size:13px;color:{TEXT_SOFT};'
                f'line-height:1.55;margin:0 0 8px;padding-left:10px;border-left:3px solid {TEAL};">'
                f'{escape(str(line))}</div>'
            )
    acq_body = _pair_rows(acq_rows) + insight_html

    plan_rows = [(str(p.get("name") or "?"), _fmt_int(p.get("users"))) for p in plans[:8]]
    plans_html = _section_panel(sec_plans, _pair_rows(plan_rows), accent="#E8A87C") if plan_rows else ""

    cta = (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 0;">'
        f'<tr><td align="center" style="background:{CREAM};padding:8px 20px 28px;border-radius:0 0 22px 22px;">'
        f'<a href="{escape(admin_url, quote=True)}" style="font-family:{font};display:inline-block;'
        f'background:{NAVY};color:#ffffff;padding:16px 36px;border-radius:999px;text-decoration:none;'
        f'font-size:15px;font-weight:700;border:1.5px solid {NAVY};box-shadow:0 8px 24px rgba(26,35,64,0.35);">'
        f'{escape(btn)}</a></td></tr></table>'
    )

    cream_wrap_open = (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" '
        f'style="background:{CREAM};"><tr><td style="padding:12px 12px 0;">'
    )
    cream_wrap_close = "</td></tr></table>"

    body = (
        hero
        + scoreboard
        + cream_wrap_open
        + _alert_ribbon(alerts, lang=lang)
        + sparks_panel
        + _section_panel(sec_cum, cum_body, accent=NAVY, eyebrow="Snapshot")
        + _section_panel(sec_acq, acq_body, accent="#7C5CBF", eyebrow="Growth")
        + _section_panel(sec_list, list_body, accent=TEAL, eyebrow="Audience")
        + _section_panel(sec_mkt, mkt_body, accent="#5B7CFA", eyebrow="Automation")
        + _section_panel(sec_drip, drip_body, accent="#C97B84", eyebrow="Funnel")
        + _section_panel(sec_ops, ops_body, accent="#E8A87C", eyebrow="Health")
        + plans_html
        + cream_wrap_close
        + cta
    )

    preheader = (
        f"{_fmt_int(h.get('new_users_today'))} new · "
        f"{_fmt_eur(rev.get('cash_today_eur'))} · "
        f"open {_fmt_pct(mkt_today.get('open_rate'))} · "
        f"MRR {_fmt_eur(cum.get('recognized_mrr_eur'))}"
    )
    return EmailMessage(subject=subject, html=_report_shell(body, preheader=preheader))



def render_support_received_email(
    *,
    name: Optional[str],
    subject: str,
    category: str,
    lang: str = "el",
) -> EmailMessage:
    """Ack to the mom after she submits an in-app contact message."""
    lang = normalize_email_lang(lang)
    subj = escape((subject or "").strip() or "HeyMaa")
    cat = escape((category or "general").strip())
    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                f'We received your message about <strong style="color:{TEXT};">{subj}</strong> '
                f"({cat}). Our team will reply by email and in the app Help &amp; contact screen."
            )
            + _paragraph(
                "This channel is for account, billing, and product help — not medical emergencies. "
                "If you or your child need urgent care, contact a doctor or local emergency services."
            )
            + _help_footer(lang)
        )
        return EmailMessage(
            subject="We received your HeyMaa message",
            html=_email_shell(body, preheader="Our team will get back to you"),
        )
    body = (
        _greeting(name, lang)
        + _paragraph(
            f'Λάβαμε το μήνυμά σου για <strong style="color:{TEXT};">{subj}</strong> '
            f"({cat}). Θα απαντήσουμε με email και μέσα στην εφαρμογή (Βοήθεια &amp; επικοινωνία)."
        )
        + _paragraph(
            "Αυτό το κανάλι είναι για λογαριασμό, πληρωμές και την εφαρμογή — όχι για επείγοντα "
            "ιατρικά θέματα. Σε επείγουσα περίπτωση επικοινώνησε με γιατρό ή τις τοπικές υπηρεσίες."
        )
        + _help_footer(lang)
    )
    return EmailMessage(
        subject="Λάβαμε το μήνυμά σου στο HeyMaa",
        html=_email_shell(body, preheader="Θα σου απαντήσουμε σύντομα"),
    )


def render_support_admin_reply_email(
    *,
    name: Optional[str],
    subject: str,
    reply_body: str,
    lang: str = "el",
) -> EmailMessage:
    """Email the mom when an admin replies from the Support Inbox."""
    lang = normalize_email_lang(lang)
    subj = escape((subject or "").strip() or "HeyMaa")
    reply = escape((reply_body or "").strip()).replace("\n", "<br>")
    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                f'Reply from HeyMaa Support about <strong style="color:{TEXT};">{subj}</strong>:'
            )
            + (
                f'<div style="font-family:{_font()};color:{TEXT};font-size:15px;line-height:1.65;'
                f'background:#f6f4f1;border-radius:12px;padding:14px 16px;margin:0 0 16px;">{reply}</div>'
            )
            + _paragraph(
                "You can continue the conversation in the app under Help &amp; contact, or reply to this email."
            )
            + _help_footer(lang)
        )
        return EmailMessage(
            subject=f"Re: {subject.strip()[:80] or 'HeyMaa support'}",
            html=_email_shell(body, preheader="New reply from HeyMaa Support"),
        )
    body = (
        _greeting(name, lang)
        + _paragraph(
            f'Απάντηση από το HeyMaa Support για <strong style="color:{TEXT};">{subj}</strong>:'
        )
        + (
            f'<div style="font-family:{_font()};color:{TEXT};font-size:15px;line-height:1.65;'
            f'background:#f6f4f1;border-radius:12px;padding:14px 16px;margin:0 0 16px;">{reply}</div>'
        )
        + _paragraph(
            "Μπορείς να συνεχίσεις τη συνομιλία στην εφαρμογή (Βοήθεια &amp; επικοινωνία) ή να απαντήσεις σε αυτό το email."
        )
        + _help_footer(lang)
    )
    return EmailMessage(
        subject=f"Απ: {(subject or '').strip()[:80] or 'HeyMaa'}",
        html=_email_shell(body, preheader="Νέα απάντηση από το HeyMaa Support"),
    )


def render_support_admin_alert_email(
    *,
    subject: str,
    category: str,
    from_email: str,
    from_name: Optional[str],
    body_text: str,
    thread_id: str,
) -> EmailMessage:
    """Notify the support inbox email about a new in-app contact."""
    subj = escape((subject or "").strip())
    cat = escape((category or "general").strip())
    who = escape((from_name or "").strip() or from_email)
    em = escape(from_email)
    preview = escape((body_text or "").strip()[:800]).replace("\n", "<br>")
    tid = escape(thread_id)
    html_body = (
        f'<p style="font-family:{_font()};color:{TEXT};font-size:15px;line-height:1.65;">'
        f"New in-app support message</p>"
        f'<p style="font-family:{_font()};color:{TEXT};font-size:14px;line-height:1.55;">'
        f"<strong>From:</strong> {who} &lt;{em}&gt;<br>"
        f"<strong>Category:</strong> {cat}<br>"
        f"<strong>Subject:</strong> {subj}<br>"
        f"<strong>Thread:</strong> {tid}</p>"
        f'<div style="font-family:{_font()};color:{TEXT};font-size:14px;line-height:1.6;'
        f'background:#f6f4f1;border-radius:12px;padding:14px 16px;">{preview}</div>'
        f'<p style="font-family:{_font()};color:{MUTED};font-size:12px;margin-top:16px;">'
        f"Reply from Admin → Support Inbox.</p>"
    )
    return EmailMessage(
        subject=f"[HeyMaa Support] {subject.strip()[:90] or 'New message'}",
        html=_email_shell(html_body, preheader="New in-app support message"),
    )


def _broadcast_images(urls: Optional[list[str]]) -> str:
    parts: list[str] = []
    for raw in urls or []:
        url = (raw or "").strip()
        if not url.startswith("https://") or len(url) > 800:
            continue
        safe = escape(url, quote=True)
        parts.append(
            f'<img src="{safe}" alt="" width="504" '
            f'style="display:block;width:100%;max-width:504px;height:auto;'
            f'border-radius:12px;margin:0 0 16px;border:0;" />'
        )
        if len(parts) >= 4:
            break
    return "".join(parts)


def _format_admin_body_html(text: str) -> str:
    """Escape plain admin copy, then apply a tiny formatting allowlist."""
    safe = escape(text or "")
    # Bold / italic (after escape so raw HTML never passes through).
    safe = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", safe, flags=re.DOTALL)
    safe = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", safe, flags=re.DOTALL)

    lines = safe.split("\n")
    parts: list[str] = []
    in_list = False
    for line in lines:
        stripped = line.lstrip()
        is_bullet = stripped.startswith("- ") or stripped.startswith("• ")
        if is_bullet:
            item = stripped[2:].strip()
            if not in_list:
                parts.append('<ul style="margin:10px 0 10px 18px;padding:0;">')
                in_list = True
            parts.append(f'<li style="margin:0 0 6px;">{item}</li>')
            continue
        if in_list:
            parts.append("</ul>")
            in_list = False
        if line.strip() == "":
            parts.append("<br>")
        else:
            parts.append(f"{line}<br>")
    if in_list:
        parts.append("</ul>")
    html = "".join(parts)
    # Drop a trailing <br> from the last paragraph line.
    if html.endswith("<br>"):
        html = html[:-4]
    return html


def _gift_code_reward_bits(
    *,
    gift_type: str,
    plan_slot: Optional[str],
    days: Optional[int],
    points: Optional[int],
    lang: str,
) -> list[str]:
    bits: list[str] = []
    gtype = (gift_type or "").strip().lower()
    if gtype in ("free_plan_days", "combo"):
        bits.append(_gift_line(int(days or 0), str(plan_slot or "starter"), lang))
    if gtype in ("bonus_points", "combo") and int(points or 0) > 0:
        pts = int(points or 0)
        bits.append(f"+{pts} πόντοι" if lang == "el" else f"+{pts} points")
    return bits


def render_gift_code_offer_email(
    *,
    name: Optional[str],
    code: str,
    gift_type: str,
    plan_slot: Optional[str] = None,
    days: Optional[int] = None,
    points: Optional[int] = None,
    label: Optional[str] = None,
    claim_url: str,
    lang: str = "el",
) -> EmailMessage:
    """Announcement for a redeemable marketing gift code."""
    lang = normalize_email_lang(lang)
    bits = _gift_code_reward_bits(
        gift_type=gift_type,
        plan_slot=plan_slot,
        days=days,
        points=points,
        lang=lang,
    )
    reward = " · ".join(bits) if bits else (label or code)
    title = escape((label or "").strip() or ("HeyMaa gift" if lang == "en" else "Δώρο HeyMaa"))
    href = (claim_url or "").strip() or "#"

    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                f'You have a gift waiting: <strong style="color:{TEXT};">{title}</strong>.'
            )
            + _paragraph(f"<strong style=\"color:{TEXT};\">{escape(reward)}</strong>")
            + _paragraph(
                "Open HeyMaa and claim it with one tap. If you are signed out, sign in first — "
                "the gift stays attached to your link."
            )
            + _button(href, "Claim your gift")
            + _help_footer(lang)
        )
        subject = f"Your HeyMaa gift: {reward}"[:140]
        preheader = "Tap to claim your gift in the app"
    else:
        body = (
            _greeting(name, lang)
            + _paragraph(
                f'Έχεις ένα δώρο που σε περιμένει: <strong style="color:{TEXT};">{title}</strong>.'
            )
            + _paragraph(f"<strong style=\"color:{TEXT};\">{escape(reward)}</strong>")
            + _paragraph(
                "Άνοιξε την HeyMaa και πάρε το με ένα πάτημα. Αν έχεις αποσυνδεθεί, συνδέσου πρώτα — "
                "το δώρο μένει στο σύνδεσμο."
            )
            + _button(href, "Πάρε το δώρο σου")
            + _help_footer(lang)
        )
        subject = f"Το δώρο σου από την HeyMaa: {reward}"[:140]
        preheader = "Πάτα για να το ενεργοποιήσεις στην εφαρμογή"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def render_gift_code_claimed_email(
    *,
    name: Optional[str],
    gift_type: str,
    plan_slot: Optional[str] = None,
    days: Optional[int] = None,
    points: Optional[int] = None,
    grant: Optional[dict] = None,
    app_url: str,
    lang: str = "el",
) -> EmailMessage:
    """Confirmation after a marketing gift code is successfully claimed."""
    lang = normalize_email_lang(lang)
    app_href = f"{app_url.rstrip('/')}/app"
    bits = _gift_code_reward_bits(
        gift_type=gift_type,
        plan_slot=(grant or {}).get("plan_slot") or plan_slot,
        days=(grant or {}).get("days") if grant and grant.get("days") is not None else days,
        points=points,
        lang=lang,
    )
    reward = " · ".join(bits) if bits else ("your gift" if lang == "en" else "το δώρο σου")
    end_label = _format_email_date((grant or {}).get("ends_at"), lang) if grant else ""
    start_label = _format_email_date((grant or {}).get("starts_at"), lang) if grant else ""

    if lang == "en":
        timing = ""
        if grant and grant.get("upgraded"):
            timing = "Matched to your current plan. Extra days start after your current access ends."
        elif start_label and end_label:
            timing = f"Plan days run from {start_label} until {end_label}."
        elif end_label:
            timing = f"Plan days are active until {end_label}."
        body = (
            _greeting(name, lang)
            + _paragraph(
                f'Done! Your gift is active: <strong style="color:{TEXT};">{escape(reward)}</strong>.'
            )
            + (_paragraph(timing) if timing else "")
            + _button(app_href, "Open HeyMaa")
            + _help_footer(lang)
        )
        subject = "Your HeyMaa gift is active"
        preheader = "Gift claimed successfully"
    else:
        timing = ""
        if grant and grant.get("upgraded"):
            timing = "Προσαρμόστηκε στο τρέχον πλάνο σου. Οι επιπλέον μέρες ξεκινούν όταν τελειώσει η τρέχουσα πρόσβαση."
        elif start_label and end_label:
            timing = f"Οι μέρες ισχύουν από {start_label} έως {end_label}."
        elif end_label:
            timing = f"Οι μέρες ισχύουν έως {end_label}."
        body = (
            _greeting(name, lang)
            + _paragraph(
                f'Έγινε! Το δώρο σου ενεργοποιήθηκε: <strong style="color:{TEXT};">{escape(reward)}</strong>.'
            )
            + (_paragraph(timing) if timing else "")
            + _button(app_href, "Άνοιξε την HeyMaa")
            + _help_footer(lang)
        )
        subject = "Το δώρο σου στην HeyMaa ενεργοποιήθηκε"
        preheader = "Το δώρο διεκδικήθηκε με επιτυχία"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def render_admin_broadcast_email(
    *,
    subject: str,
    body: str,
    link: Optional[str] = None,
    button_label: Optional[str] = None,
    name: Optional[str] = None,
    images: Optional[list[str]] = None,
    for_preview: bool = False,
) -> EmailMessage:
    """Admin-written message, wrapped in the HeyMaa email shell. {name} is optional."""
    who = (name or "").strip()
    subj = (subject or "").replace("{name}", who).strip()
    text = (body or "").replace("{name}", who)
    formatted = _format_admin_body_html(text)
    html_body = (
        f'<div style="font-family:{_font()};color:{TEXT};font-size:15px;line-height:1.65;">{formatted}</div>'
    )
    pictures = _broadcast_images(images)
    if pictures:
        html_body += f'<div style="margin-top:8px;">{pictures}</div>'
    if link:
        label = (button_label or "").strip() or "Open HeyMaa"
        html_body += _button(link, label[:48])
    html = _email_shell(html_body, preheader=subj[:140])
    if for_preview:
        raw = _read_logo_bytes()
        if raw:
            html = html.replace(
                f"cid:{LOGO_CID}",
                "data:image/png;base64," + base64.b64encode(raw).decode("ascii"),
            )
    return EmailMessage(
        subject=subj[:180] or "HeyMaa",
        html=html,
    )


def send_email(
    *,
    api_key: str,
    from_address: str,
    to: str,
    message: EmailMessage,
    kind: str = "transactional",
    campaign_id: Optional[str] = None,
    user_id: Optional[str] = None,
    to_name: Optional[str] = None,
    tags: Optional[dict[str, str]] = None,
) -> Optional[str]:
    """Send via Resend. Returns None on success, error string on failure.

    Optional kind/campaign_id/tags are stored for admin email reports when
    backend/migrations/email_analytics.sql is applied and Resend webhooks fire.
    """
    if not api_key:
        return "RESEND_API_KEY is not configured on the server."
    import resend as _resend

    _resend.api_key = api_key
    tag_pairs = []
    merged_tags: dict[str, str] = {}
    if kind:
        merged_tags["kind"] = re.sub(r"[^a-zA-Z0-9_\-]", "", str(kind))[:40] or "transactional"
    if campaign_id:
        merged_tags["campaign_id"] = re.sub(r"[^a-zA-Z0-9_\-]", "", str(campaign_id))[:60]
    for key, val in (tags or {}).items():
        k = re.sub(r"[^a-zA-Z0-9_\-]", "", str(key))[:40]
        v = re.sub(r"[^a-zA-Z0-9_\-]", "", str(val))[:60]
        if k and v:
            merged_tags[k] = v
    for key, val in merged_tags.items():
        tag_pairs.append({"name": key, "value": val})

    payload: dict = {
        "from": from_address,
        "to": to.strip(),
        "subject": message.subject,
        "html": message.html,
    }
    if tag_pairs:
        payload["tags"] = tag_pairs[:20]
    attachment = logo_attachment()
    if attachment:
        payload["attachments"] = [attachment]
    resend_id = None
    last_err: Optional[str] = None
    for attempt in range(3):
        try:
            resp = _resend.Emails.send(payload)
            if isinstance(resp, dict):
                resend_id = str(resp.get("id") or "") or None
            else:
                resend_id = str(getattr(resp, "id", "") or "") or None
            last_err = None
            break
        except Exception as e:
            last_err = str(e)
            transient = any(
                token in last_err.lower()
                for token in (
                    "ssl",
                    "eof",
                    "timed out",
                    "timeout",
                    "connection",
                    "temporarily",
                    "reset",
                    "max retries",
                )
            )
            if attempt < 2 and transient:
                time.sleep(0.4 * (attempt + 1))
                continue
            try:
                from email_analytics import record_send
            except ImportError:
                try:
                    from .email_analytics import record_send
                except ImportError:
                    record_send = None  # type: ignore
            if record_send:
                record_send(
                    resend_id=None,
                    to_email=to,
                    subject=message.subject,
                    kind=kind,
                    campaign_id=campaign_id,
                    user_id=user_id,
                    to_name=to_name,
                    tags=merged_tags,
                    status="failed",
                )
            return last_err
    if last_err:
        return last_err
    try:
        from email_analytics import record_send
    except ImportError:
        try:
            from .email_analytics import record_send
        except ImportError:
            record_send = None  # type: ignore
    if record_send:
        record_send(
            resend_id=resend_id,
            to_email=to,
            subject=message.subject,
            kind=kind,
            campaign_id=campaign_id,
            user_id=user_id,
            to_name=to_name,
            tags=merged_tags,
            status="sent",
        )
    return None


def _logo_url_for_batch() -> str:
    explicit = (os.getenv("EMAIL_LOGO_URL") or "").strip()
    if explicit:
        return explicit
    base = (os.getenv("APP_URL") or DEFAULT_APP_URL).rstrip("/")
    return f"{base}/static/brand/{LOGO_FILENAME}"


def _tag_pairs_for_send(
    *,
    kind: str,
    campaign_id: Optional[str],
    tags: Optional[dict[str, str]],
) -> tuple[list[dict[str, str]], dict[str, str]]:
    merged_tags: dict[str, str] = {}
    if kind:
        merged_tags["kind"] = re.sub(r"[^a-zA-Z0-9_\-]", "", str(kind))[:40] or "transactional"
    if campaign_id:
        merged_tags["campaign_id"] = re.sub(r"[^a-zA-Z0-9_\-]", "", str(campaign_id))[:60]
    for key, val in (tags or {}).items():
        k = re.sub(r"[^a-zA-Z0-9_\-]", "", str(key))[:40]
        v = re.sub(r"[^a-zA-Z0-9_\-]", "", str(val))[:60]
        if k and v:
            merged_tags[k] = v
    pairs = [{"name": key, "value": val} for key, val in merged_tags.items()]
    return pairs[:20], merged_tags


def send_emails_batch(
    *,
    api_key: str,
    from_address: str,
    items: list[dict],
    idempotency_key: Optional[str] = None,
) -> list[tuple[Optional[str], Optional[str]]]:
    """Send many emails in one Resend Batch request (max 100).

    Each item: {to, message: EmailMessage, kind?, campaign_id?, user_id?, to_name?, tags?}.
    Returns parallel list of (resend_id|None, error|None). Batch does not support attachments;
    CID logo is rewritten to a hosted URL.
    """
    if not api_key:
        return [(None, "RESEND_API_KEY is not configured on the server.") for _ in items]
    if not items:
        return []
    if len(items) > 100:
        raise ValueError("Resend batch accepts at most 100 emails per request")

    import resend as _resend

    _resend.api_key = api_key
    logo_url = _logo_url_for_batch()
    payloads: list[dict] = []
    meta: list[dict] = []
    for item in items:
        message: EmailMessage = item["message"]
        html = (message.html or "").replace(f"cid:{LOGO_CID}", logo_url)
        pairs, merged_tags = _tag_pairs_for_send(
            kind=str(item.get("kind") or "transactional"),
            campaign_id=item.get("campaign_id"),
            tags=item.get("tags"),
        )
        payload: dict = {
            "from": from_address,
            "to": [str(item["to"]).strip()],
            "subject": message.subject,
            "html": html,
        }
        if pairs:
            payload["tags"] = pairs
        payloads.append(payload)
        meta.append({**item, "merged_tags": merged_tags, "subject": message.subject})

    try:
        if idempotency_key:
            resp = _resend.Batch.send(payloads, {"idempotency_key": idempotency_key})
        else:
            resp = _resend.Batch.send(payloads)
    except Exception as e:
        err = str(e)[:400]
        return [(None, err) for _ in items]

    data = []
    if isinstance(resp, dict):
        data = resp.get("data") or []
    else:
        data = getattr(resp, "data", None) or []

    results: list[tuple[Optional[str], Optional[str]]] = []
    try:
        from email_analytics import record_send
    except ImportError:
        try:
            from .email_analytics import record_send
        except ImportError:
            record_send = None  # type: ignore

    for idx, item_meta in enumerate(meta):
        entry = data[idx] if idx < len(data) else None
        resend_id = None
        if isinstance(entry, dict):
            resend_id = str(entry.get("id") or "") or None
        elif entry is not None:
            resend_id = str(getattr(entry, "id", "") or "") or None
        if record_send:
            record_send(
                resend_id=resend_id,
                to_email=str(item_meta["to"]),
                subject=str(item_meta.get("subject") or ""),
                kind=str(item_meta.get("kind") or "transactional"),
                campaign_id=item_meta.get("campaign_id"),
                user_id=item_meta.get("user_id"),
                to_name=item_meta.get("to_name"),
                tags=item_meta.get("merged_tags") or {},
                status="sent" if resend_id else "failed",
            )
        if resend_id:
            results.append((resend_id, None))
        else:
            results.append((None, "Batch response missing email id"))
    return results
