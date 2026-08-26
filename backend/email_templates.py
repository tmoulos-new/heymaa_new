"""Branded transactional email templates for HeyMaa (Greek-first, English supported)."""

from __future__ import annotations

from dataclasses import dataclass
from html import escape
from typing import Optional

try:
    from .greek_text import greek_vocative
except ImportError:
    from greek_text import greek_vocative

# Brand palette (matches frontend --hm-* tokens)
NAVY = "#2B3A67"
TEAL = "#4ABEAA"
CREAM = "#F5F0EB"
BEIGE = "#F8E5D6"
MUTED = "#7A7068"
BODY = "#555555"
BORDER = "#F0EBE6"
LAVENDER = "#BEB4CD"

SUPPORT_EMAIL = "info@heymaa.ai"


@dataclass(frozen=True)
class EmailMessage:
    subject: str
    html: str


def normalize_email_lang(lang: Optional[str]) -> str:
    code = (lang or "el").strip().lower()
    return "en" if code == "en" else "el"


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
        "starter": ("Starter — €19/μήνα", "Starter — €19/month"),
        "premium": ("Premium — €39/μήνα", "Premium — €39/month"),
        "annual": ("Ετήσιο Premium — €199/έτος", "Annual Premium — €199/year"),
        "annual_premium": ("Ετήσιο Premium — €199/έτος", "Annual Premium — €199/year"),
        "trial": ("Δωρεάν δοκιμή", "Free trial"),
    }
    pair = labels.get(key)
    if pair:
        return pair[1 if lang == "en" else 0]
    return plan or ("Συνδρομή" if lang == "el" else "Subscription")


def _email_shell(body_html: str, *, preheader: str = "") -> str:
    preheader_html = ""
    if preheader:
        preheader_html = (
            f'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
            f"{escape(preheader)}</div>"
        )
    return f"""<!DOCTYPE html>
<html lang="el">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:{CREAM};">
{preheader_html}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:{CREAM};">
  <tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid {BORDER};overflow:hidden;">
      <tr><td style="padding:32px 36px 24px;">
        <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:{NAVY};line-height:1.2;margin-bottom:4px;">
          Hey<span style="color:{TEAL};">Maa</span>
        </div>
        <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:{MUTED};margin-bottom:24px;">by Care Direct</div>
        {body_html}
      </td></tr>
      <tr><td style="padding:0 36px 28px;">
        <div style="border-top:1px solid {BORDER};padding-top:16px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;color:{MUTED};line-height:1.6;">
          HeyMaa · {escape(SUPPORT_EMAIL)}<br>
          Care Direct — υποστήριξη γονέων &amp; εγκύων
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


def _paragraph(text: str) -> str:
    return (
        f'<p style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:14px;'
        f'color:{BODY};line-height:1.7;margin:0 0 16px;">{text}</p>'
    )


def _greeting(name: Optional[str], lang: str) -> str:
    who = escape(_display_name(name, lang))
    if lang == "en":
        return (
            f'<p style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:16px;'
            f'color:{NAVY};margin:0 0 12px;">Hi <strong>{who}</strong>! 👋</p>'
        )
    return (
        f'<p style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:16px;'
        f'color:{NAVY};margin:0 0 12px;">Γεια σου <strong>{who}</strong>! 👋</p>'
    )


def _button(href: str, label: str) -> str:
    return (
        f'<p style="margin:24px 0;text-align:center;">'
        f'<a href="{escape(href, quote=True)}" style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;'
        f'background:{NAVY};color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;'
        f'font-size:14px;font-weight:600;display:inline-block;">{escape(label)}</a></p>'
    )


def _code_box(label: str, code: str) -> str:
    return (
        f'<div style="background:{CREAM};border-radius:12px;padding:20px;margin:20px 0;text-align:center;">'
        f'<div style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:11px;color:{MUTED};'
        f'margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">{escape(label)}</div>'
        f'<div style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;'
        f'color:{NAVY};letter-spacing:2px;">{escape(code)}</div></div>'
    )


def _steps_panel(title: str, steps: list[str]) -> str:
    items = "".join(
        f'<li style="margin-bottom:6px;">{step}</li>' for step in steps
    )
    return (
        f'<div style="background:{NAVY};border-radius:12px;padding:20px;margin:20px 0;">'
        f'<div style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:13px;'
        f'color:{BEIGE};margin-bottom:12px;font-weight:600;">{escape(title)}</div>'
        f'<ol style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;color:#ffffff;'
        f'font-size:13px;line-height:1.9;margin:0;padding-left:18px;">{items}</ol></div>'
    )


def _help_footer(lang: str) -> str:
    if lang == "en":
        return _paragraph(
            f'Need help? Reply to this email or write to '
            f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{TEAL};">{SUPPORT_EMAIL}</a>. '
            f'Thank you for trusting HeyMaa! 🌸'
        )
    return _paragraph(
        f'Αν χρειαστείς βοήθεια, απάντησε σε αυτό το email ή γράψε στο '
        f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{TEAL};">{SUPPORT_EMAIL}</a>.<br>'
        f'Σε ευχαριστούμε που μας εμπιστεύεσαι! 🌸'
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
        f'<p style="font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:16px;color:{NAVY};margin:0 0 12px;">'
        f'Γεια σου <strong>{greet_name}</strong>! 👋</p>'
        + _paragraph(
            f'Σε καλωσορίζουμε στο <strong>HeyMaa Beta</strong>! Είσαι ένας από τους πρώτους '
            f'ανθρώπους που θα δοκιμάσουν την εφαρμογή μας. '
            f'Ο λογαριασμός σου έχει ρυθμιστεί στο πακέτο <strong>{escape(plan_label)}</strong>.'
        )
        + _code_box("Κωδικός Πρόσκλησης", invite_code)
        + _steps_panel(
            "📱 Οδηγίες Εισόδου",
            [
                'Άνοιξε το app <strong>από κινητό</strong> σε <strong>incognito mode</strong>',
                f'Επισκέψου: <a href="{escape(app_url, quote=True)}" style="color:{TEAL};">{escape(app_url)}</a>',
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
) -> EmailMessage:
    lang = normalize_email_lang(lang)
    if lang == "en":
        body = (
            _greeting(name, lang)
            + _paragraph(
                "We received a request to reset your HeyMaa password. "
                f"The link below is valid for <strong>{expires_hours} hours</strong>."
            )
            + _button(reset_url, "Reset password")
            + _paragraph(
                f'If the button does not work, copy this link:<br>'
                f'<a href="{escape(reset_url, quote=True)}" style="color:{TEAL};word-break:break-all;">'
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
                f"Το link ισχύει για <strong>{expires_hours} ώρες</strong>."
            )
            + _button(reset_url, "Επαναφορά κωδικού")
            + _paragraph(
                f'Αν το κουμπί δεν λειτουργεί, αντέγραψε αυτό το link:<br>'
                f'<a href="{escape(reset_url, quote=True)}" style="color:{TEAL};word-break:break-all;">'
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
                f"Welcome to <strong>HeyMaa</strong>! Your account is ready with a "
                f"<strong>{trial_days}-day free trial</strong> ({plan})."
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
                f"Καλώς ήρθες στην <strong>HeyMaa</strong>! Ο λογαριασμός σου είναι έτοιμος με "
                f"<strong>{trial_days} ημέρες δωρεάν δοκιμή</strong> ({plan})."
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
                f"<strong>{escape(plan_label)}</strong>."
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
                f"<strong>{escape(plan_label)}</strong>."
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
                f"Thank you for your purchase! Your <strong>{escape(plan_label)}</strong> "
                f"plan is ready — use the invite code below to create your HeyMaa account."
            )
            + _code_box("Invite code", invite_code)
            + _steps_panel(
                "Getting started",
                [
                    f'Open <a href="{escape(signup_url, quote=True)}" style="color:{TEAL};">HeyMaa</a> on your phone',
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
                f"Ευχαριστούμε για την αγορά σου! Το πακέτο <strong>{escape(plan_label)}</strong> "
                f"είναι έτοιμο — χρησιμοποίησε τον κωδικό πρόσκλησης παρακάτω για να δημιουργήσεις λογαριασμό HeyMaa."
            )
            + _code_box("Κωδικός πρόσκλησης", invite_code)
            + _steps_panel(
                "📱 Πρώτα βήματα",
                [
                    f'Άνοιξε την <a href="{escape(signup_url, quote=True)}" style="color:{TEAL};">HeyMaa</a> από κινητό',
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
                f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{TEAL};">{SUPPORT_EMAIL}</a>.'
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
                f'<a href="mailto:{SUPPORT_EMAIL}" style="color:{TEAL};">{SUPPORT_EMAIL}</a>.'
            )
            + _button(app_url, "Άνοιξε την HeyMaa")
            + _help_footer(lang)
        )
        subject = "Ο κωδικός σου στην HeyMaa άλλαξε"
        preheader = "Επιβεβαίωση αλλαγής κωδικού"
    return EmailMessage(subject=subject, html=_email_shell(body, preheader=preheader))


def send_email(
    *,
    api_key: str,
    from_address: str,
    to: str,
    message: EmailMessage,
) -> Optional[str]:
    """Send via Resend. Returns None on success, error string on failure."""
    if not api_key:
        return "RESEND_API_KEY is not configured on the server."
    import resend as _resend

    _resend.api_key = api_key
    try:
        _resend.Emails.send({
            "from": from_address,
            "to": to.strip(),
            "subject": message.subject,
            "html": message.html,
        })
    except Exception as e:
        return str(e)
    return None
