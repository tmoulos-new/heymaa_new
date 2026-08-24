import os
import time
from typing import Any, Optional

import httpx

try:
    from .viva_checkout import VIVA_PLANS, _viva_access_token, _viva_api_base, viva_configured
except ImportError:
    from viva_checkout import VIVA_PLANS, _viva_access_token, _viva_api_base, viva_configured

VIVA_EVENT_PAYMENT_CREATED = 1796
VIVA_EVENT_PAYMENT_FAILED = 1798
VIVA_SUCCESS_STATUS_IDS = {"F", "C"}
VIVA_FAILED_STATUS_IDS = {"E"}

_webhook_key_cache: dict[str, Any] = {"value": None, "expires_at": 0.0}


def _env_first(*names: str) -> str:
    for name in names:
        value = (os.getenv(name) or "").strip()
        if value:
            return value
    return ""


def _merchant_basic_credentials() -> Optional[tuple[str, str]]:
    merchant_id = _env_first(
        "VIVA_WALLET_MERCHANT_ID",
        "VIVA_MERCHANT_ID",
        "VIVA_MERCHANTID",
    )
    api_key = _env_first(
        "VIVA_WALLET_API_KEY",
        "VIVA_API_KEY",
        "VIVA_API_Key",
    )
    if merchant_id and api_key:
        return merchant_id, api_key
    return None


def viva_webhook_configured() -> bool:
    if _env_first("VIVA_WEBHOOK_KEY", "VIVA_WEBHOOK_VERIFICATION_KEY"):
        return True
    return _merchant_basic_credentials() is not None


def viva_webhook_env_status() -> dict[str, bool]:
    merchant_id = _env_first(
        "VIVA_WALLET_MERCHANT_ID",
        "VIVA_MERCHANT_ID",
        "VIVA_MERCHANTID",
    )
    api_key = _env_first(
        "VIVA_WALLET_API_KEY",
        "VIVA_API_KEY",
        "VIVA_API_Key",
    )
    webhook_key = _env_first("VIVA_WEBHOOK_KEY", "VIVA_WEBHOOK_VERIFICATION_KEY")
    return {
        "checkout_configured": viva_configured(),
        "webhook_key_set": bool(webhook_key),
        "merchant_id_set": bool(merchant_id),
        "api_key_set": bool(api_key),
        "webhook_configured": viva_webhook_configured(),
    }


def parse_merchant_trns(value: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Parse heymaa:{plan} or heymaa:{plan}:{user_id} from merchantTrns."""
    raw = (value or "").strip()
    if not raw.lower().startswith("heymaa:"):
        return None, None
    parts = raw.split(":")
    if len(parts) < 2:
        return None, None
    plan_key = parts[1].strip().lower()
    if plan_key not in VIVA_PLANS:
        return None, None
    user_id = parts[2].strip() if len(parts) >= 3 and parts[2].strip() else None
    return plan_key, user_id


def plan_db_value(plan_key: str) -> str:
    return VIVA_PLANS[plan_key]["plan"]


def _amount_cents(value: Any) -> int:
    if value is None:
        return 0
    amount = float(value)
    if abs(amount - round(amount)) > 0.001:
        return int(round(amount * 100))
    if amount >= 500:
        return int(round(amount))
    return int(round(amount * 100))


def amount_matches_plan(amount_raw: Any, plan_key: str) -> bool:
    expected = VIVA_PLANS.get(plan_key, {}).get("amount")
    if expected is None:
        return False
    received = _amount_cents(amount_raw)
    return received == int(expected)


def _event_data(payload: dict) -> dict:
    data = payload.get("EventData") or payload.get("eventData")
    return data if isinstance(data, dict) else {}


def _payload_value(payload: dict, *keys: str) -> Any:
    for source in (payload, _event_data(payload)):
        for key in keys:
            if key in source and source[key] is not None:
                return source[key]
        lower = {str(k).lower(): v for k, v in source.items()}
        for key in keys:
            lk = key.lower()
            if lk in lower and lower[lk] is not None:
                return lower[lk]
    return None


async def fetch_webhook_verification_key() -> str:
    cached = _env_first("VIVA_WEBHOOK_KEY", "VIVA_WEBHOOK_VERIFICATION_KEY")
    if cached:
        return cached

    now = time.time()
    if _webhook_key_cache["value"] and _webhook_key_cache["expires_at"] > now:
        return str(_webhook_key_cache["value"])

    creds = _merchant_basic_credentials()
    if not creds:
        raise ValueError(
            "Webhook verification is not configured on Vercel. Add VIVA_WEBHOOK_KEY "
            "or VIVA_WALLET_MERCHANT_ID + VIVA_WALLET_API_KEY (Production), then redeploy."
        )

    merchant_id, api_key = creds
    token_urls = [
        f"{_viva_api_base()}/api/messages/config/token",
        "https://www.vivapayments.com/api/messages/config/token",
    ]
    last_status: Optional[int] = None
    async with httpx.AsyncClient(timeout=20.0) as client:
        data = None
        for url in token_urls:
            res = await client.get(url, auth=(merchant_id, api_key))
            last_status = res.status_code
            if res.status_code == 401:
                raise ValueError(
                    "Viva rejected the Merchant ID / API Key. Use credentials from "
                    "Viva → Settings → API Access (not Client ID / Client Secret)."
                )
            if res.status_code == 404:
                continue
            res.raise_for_status()
            data = res.json()
            break

    if data is None:
        raise ValueError(
            "Could not fetch the Viva webhook key (HTTP "
            f"{last_status or 'error'}). Add VIVA_WEBHOOK_KEY on Vercel instead: "
            "GET https://api.vivapayments.com/api/messages/config/token with Basic auth "
            "(Merchant ID + API Key from Settings → API Access), then redeploy."
        )

    key = data.get("Key") or data.get("key")
    if not key:
        raise ValueError("Viva webhook key response missing Key.")
    _webhook_key_cache["value"] = key
    _webhook_key_cache["expires_at"] = now + 3600
    return str(key)


async def webhook_verification_response() -> dict:
    key = await fetch_webhook_verification_key()
    return {"Key": key}


async def retrieve_transaction(transaction_id: str) -> dict:
    token = await _viva_access_token()
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(
            f"{_viva_api_base()}/checkout/v2/transactions/{transaction_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        res.raise_for_status()
        return res.json()


def _subscription_update_fields(plan_key: str) -> dict:
    return {
        "plan": plan_db_value(plan_key),
        "subscription_status": "active",
    }


async def activate_subscription(
    sb,
    *,
    plan_key: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
) -> dict:
    if not sb:
        raise ValueError("Database unavailable.")

    updates = _subscription_update_fields(plan_key)
    row = None

    if user_id:
        res = sb.table("users").select("id,email").eq("id", user_id).limit(1).execute()
        if res.data:
            row = res.data[0]

    if not row and email:
        normalized = email.strip().lower()
        res = sb.table("users").select("id,email").eq("email", normalized).limit(1).execute()
        if res.data:
            row = res.data[0]

    if not row:
        return {"ok": False, "reason": "user_not_found", "plan": plan_key}

    sb.table("users").update(updates).eq("id", row["id"]).execute()
    return {
        "ok": True,
        "user_id": row["id"],
        "email": row.get("email"),
        "plan": updates["plan"],
    }


async def handle_viva_payment_created(payload: dict, sb) -> dict:
    if not viva_configured():
        raise ValueError("Viva Wallet is not configured on the server.")

    transaction_id = _payload_value(payload, "TransactionId", "transactionId")
    if not transaction_id:
        return {"ok": False, "reason": "missing_transaction_id"}

    tx = await retrieve_transaction(str(transaction_id))
    status_id = str(_payload_value(tx, "statusId", "StatusId") or "").upper()
    if status_id not in VIVA_SUCCESS_STATUS_IDS:
        return {"ok": True, "ignored": True, "reason": "status_not_successful", "statusId": status_id}

    merchant_trns = _payload_value(tx, "merchantTrns", "MerchantTrns") or _payload_value(
        payload, "MerchantTrns", "merchantTrns"
    )
    plan_key, user_id = parse_merchant_trns(
        str(merchant_trns) if merchant_trns is not None else None
    )
    if not plan_key:
        return {"ok": False, "reason": "unknown_plan", "merchantTrns": merchant_trns}

    amount_raw = _payload_value(tx, "amount", "Amount") or _payload_value(payload, "Amount", "amount")
    if not amount_matches_plan(amount_raw, plan_key):
        return {
            "ok": False,
            "reason": "amount_mismatch",
            "plan": plan_key,
            "amount": amount_raw,
        }

    email = _payload_value(tx, "email", "Email") or _payload_value(payload, "Email", "email")
    result = await activate_subscription(
        sb,
        plan_key=plan_key,
        user_id=user_id,
        email=str(email).strip().lower() if email else None,
    )
    if not result.get("ok"):
        return result

    return {
        "ok": True,
        "outcome": "success",
        "transactionId": str(transaction_id),
        "orderCode": _payload_value(tx, "orderCode", "OrderCode"),
        **result,
    }


async def handle_viva_payment_failed(payload: dict, sb) -> dict:
    """Record a failed payment attempt. Do not change subscription — Viva may retry."""
    if not viva_configured():
        raise ValueError("Viva Wallet is not configured on the server.")

    transaction_id = _payload_value(payload, "TransactionId", "transactionId")
    if not transaction_id:
        return {"ok": False, "reason": "missing_transaction_id"}

    tx = await retrieve_transaction(str(transaction_id))
    status_id = str(
        _payload_value(tx, "statusId", "StatusId")
        or _payload_value(payload, "StatusId", "statusId")
        or ""
    ).upper()
    if status_id and status_id not in VIVA_FAILED_STATUS_IDS:
        return {"ok": True, "ignored": True, "reason": "status_not_failed", "statusId": status_id}

    merchant_trns = _payload_value(tx, "merchantTrns", "MerchantTrns") or _payload_value(
        payload, "MerchantTrns", "merchantTrns"
    )
    plan_key, user_id = parse_merchant_trns(
        str(merchant_trns) if merchant_trns is not None else None
    )
    response_event_id = _payload_value(
        tx, "ResponseEventId", "responseEventId"
    ) or _payload_value(payload, "ResponseEventId", "responseEventId")

    return {
        "ok": True,
        "outcome": "failed",
        "transactionId": str(transaction_id),
        "orderCode": _payload_value(tx, "orderCode", "OrderCode") or _payload_value(
            payload, "OrderCode", "orderCode"
        ),
        "plan": plan_key,
        "user_id": user_id,
        "statusId": status_id or None,
        "responseEventId": response_event_id,
        "note": "payment_failed_not_final",
    }


async def handle_viva_webhook(payload: dict, sb) -> dict:
    event_type_id = _payload_value(payload, "EventTypeId", "eventTypeId")
    if event_type_id is None:
        return {"ok": False, "reason": "missing_event_type_id"}

    event_type_id = int(event_type_id)
    if event_type_id == VIVA_EVENT_PAYMENT_CREATED:
        return await handle_viva_payment_created(payload, sb)
    if event_type_id == VIVA_EVENT_PAYMENT_FAILED:
        return await handle_viva_payment_failed(payload, sb)
    return {"ok": True, "ignored": True, "eventTypeId": event_type_id}


async def handle_viva_payment_webhook(payload: dict, sb) -> dict:
    """Backward-compatible alias for the Viva webhook dispatcher."""
    return await handle_viva_webhook(payload, sb)
