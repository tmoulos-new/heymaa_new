"""Send one of each HeyMaa transactional email template (for preview / QA)."""

from __future__ import annotations

import argparse
import os
import sys

_backend = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_root = os.path.abspath(os.path.join(_backend, ".."))
if _backend not in sys.path:
    sys.path.insert(0, _backend)

from dotenv import load_dotenv

load_dotenv(os.path.join(_root, ".env"))
load_dotenv(os.path.join(_backend, ".env"))

from email_templates import (  # noqa: E402
    render_beta_invite_email,
    render_password_changed_email,
    render_password_reset_email,
    render_subscription_activated_email,
    render_subscription_welcome_email,
    render_welcome_trial_email,
    send_email,
)

APP_URL = os.getenv("APP_URL", "https://heymaa.vercel.app")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "HeyMaa <info@heymaa.ai>")


def main() -> int:
    parser = argparse.ArgumentParser(description="Send HeyMaa sample transactional emails")
    parser.add_argument("to", help="Recipient email address")
    parser.add_argument("--name", default="Gad", help="Greeting name for templates")
    args = parser.parse_args()

    if not RESEND_API_KEY:
        print("RESEND_API_KEY is not set. Add it to backend/.env or the environment.", file=sys.stderr)
        return 1

    samples = [
        ("beta_invite", render_beta_invite_email(
            first_name=args.name,
            email=args.to,
            invite_code="HEYMAA-SAMPLE",
            plan_label="Premium",
            app_url=APP_URL,
            auth_account_ready=True,
            temporary_password="sample-temp-123",
        )),
        ("password_reset_el", render_password_reset_email(
            name=args.name,
            reset_url=f"{APP_URL}?reset=sample-token-el",
            lang="el",
            app_url=APP_URL,
        )),
        ("password_reset_en", render_password_reset_email(
            name=args.name,
            reset_url=f"{APP_URL}?reset=sample-token-en",
            lang="en",
            app_url=APP_URL,
        )),
        ("welcome_trial", render_welcome_trial_email(
            name=args.name,
            app_url=APP_URL,
            trial_days=14,
            lang="el",
        )),
        ("subscription_activated", render_subscription_activated_email(
            name=args.name,
            plan="premium",
            app_url=APP_URL,
            lang="el",
        )),
        ("subscription_welcome", render_subscription_welcome_email(
            name=args.name,
            plan="premium",
            invite_code="LS-sample-invite",
            app_url=APP_URL,
            lang="el",
        )),
        ("password_changed", render_password_changed_email(
            name=args.name,
            app_url=APP_URL,
            lang="el",
        )),
    ]

    failed = 0
    for label, message in samples:
        err = send_email(
            api_key=RESEND_API_KEY,
            from_address=RESEND_FROM,
            to=args.to,
            message=message,
        )
        if err:
            print(f"[FAIL] {label}: {err}")
            failed += 1
        else:
            print(f"[OK]   {label}: {message.subject}")

    print(f"\nSent {len(samples) - failed}/{len(samples)} emails to {args.to}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
