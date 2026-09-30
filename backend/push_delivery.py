"""Web Push (VAPID) delivery for HeyMaa marketing notifications.

Browsers show these on the lock screen only after the person allows alerts.
iPhone shows them only when HeyMaa is installed to the Home Screen (iOS 16.4+).
"""

from __future__ import annotations

import base64
import json
import os
from typing import Any, Optional

_VAPID_PATH = os.path.join(os.path.dirname(__file__), ".vapid.json")
_VAPID_SUB = os.getenv("VAPID_SUBJECT", "mailto:info@heymaa.ai")


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _load_or_create_vapid() -> tuple[str, str]:
    """Return (public_key_b64url, private_pem). Creates a local key file if needed."""
    public = (os.getenv("VAPID_PUBLIC_KEY") or "").strip()
    private = (os.getenv("VAPID_PRIVATE_KEY") or "").strip()
    if public and private:
        return public, private.replace("\\n", "\n")

    if os.path.isfile(_VAPID_PATH):
        with open(_VAPID_PATH, "r", encoding="utf-8") as fh:
            saved = json.load(fh)
        if saved.get("public_key") and saved.get("private_key"):
            return saved["public_key"], saved["private_key"]

    from py_vapid import Vapid01
    from cryptography.hazmat.primitives import serialization

    vapid = Vapid01()
    vapid.generate_keys()
    private_pem = vapid.private_pem().decode("utf-8")
    raw_pub = vapid.public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    public = _b64url(raw_pub)
    try:
        with open(_VAPID_PATH, "w", encoding="utf-8") as fh:
            json.dump({"public_key": public, "private_key": private_pem}, fh)
    except OSError:
        pass
    return public, private_pem


def vapid_status() -> dict[str, Any]:
    try:
        public, _private = _load_or_create_vapid()
        return {"configured": True, "public_key": public}
    except Exception as e:
        return {"configured": False, "public_key": None, "error": str(e)}


def send_web_push(
    subscription: dict[str, Any],
    *,
    title: str,
    body: str,
    url: Optional[str] = None,
    tag: Optional[str] = None,
) -> None:
    """Raise on delivery failure. Caller records the error."""
    public, private = _load_or_create_vapid()
    from pywebpush import webpush

    payload = json.dumps(
        {
            "title": title[:120],
            "body": body[:500],
            "url": url or "/",
            "tag": tag or "heymaa",
        }
    )
    webpush(
        subscription_info={
            "endpoint": subscription["endpoint"],
            "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
        },
        data=payload,
        vapid_private_key=private,
        vapid_claims={"sub": _VAPID_SUB},
    )
    # public key is unused at send time; referenced so a missing key fails early
    if not public:
        raise RuntimeError("VAPID public key missing")
