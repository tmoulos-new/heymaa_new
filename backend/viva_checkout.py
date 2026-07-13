import os
from typing import Optional

import httpx

VIVA_PLANS = {
    "starter": {
        "amount": 1900,
        "plan": "starter",
        "label_el": "Starter — €19/μήνα",
        "label_en": "Starter — €19/month",
    },
    "premium": {
        "amount": 3900,
        "plan": "premium",
        "label_el": "Premium — €39/μήνα",
        "label_en": "Premium — €39/month",
    },
    "annual": {
        "amount": 19900,
        "plan": "annual",
        "label_el": "Ετήσιο Premium — €199/έτος",
        "label_en": "Annual Premium — €199/year",
    },
}


def _viva_env() -> str:
    return (os.getenv("VIVA_WALLET_ENV") or "production").strip().lower()


def _viva_is_demo() -> bool:
    return _viva_env() in {"demo", "sandbox", "test"}


def _viva_accounts_url() -> str:
    if _viva_is_demo():
        return "https://demo-accounts.vivapayments.com/connect/token"
    return "https://accounts.vivapayments.com/connect/token"


def _viva_api_base() -> str:
    if _viva_is_demo():
        return "https://demo-api.vivapayments.com"
    return "https://api.vivapayments.com"


def _viva_checkout_base() -> str:
    if _viva_is_demo():
        return "https://demo.vivapayments.com/web/checkout"
    return "https://www.vivapayments.com/web/checkout"


def _viva_source_code() -> str:
    # Viva creates a built-in "Default" source for every merchant. Custom codes
    # (e.g. 7382) only work after the source is saved and enabled in the dashboard.
    return (os.getenv("VIVA_WALLET_SOURCE_CODE") or "Default").strip() or "Default"


def viva_configured() -> bool:
    return bool(
        os.getenv("VIVA_WALLET_CLIENT_ID")
        and os.getenv("VIVA_WALLET_CLIENT_SECRET")
    )


async def _viva_access_token() -> str:
    client_id = os.getenv("VIVA_WALLET_CLIENT_ID", "").strip()
    client_secret = os.getenv("VIVA_WALLET_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise ValueError("Viva Wallet credentials are not configured.")
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            _viva_accounts_url(),
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        res.raise_for_status()
        data = res.json()
        token = data.get("access_token")
        if not token:
            raise ValueError("Viva OAuth response missing access_token.")
        return token


async def create_viva_checkout_order(
    plan_key: str,
    *,
    lang: str = "el",
    customer_email: Optional[str] = None,
    customer_name: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict:
    plan = VIVA_PLANS.get(plan_key)
    if not plan:
        raise ValueError(f"Unknown plan: {plan_key}")
    source_code = _viva_source_code()

    request_lang = "el-GR" if lang == "el" else "en-GB"
    label = plan["label_el"] if lang == "el" else plan["label_en"]
    merchant_trns = f"heymaa:{plan_key}"
    if user_id:
        merchant_trns = f"{merchant_trns}:{user_id}"

    payload = {
        "amount": plan["amount"],
        "customerTrns": label,
        "merchantTrns": merchant_trns,
        "sourceCode": source_code,
        "paymentTimeout": 1800,
        "disableCash": True,
    }
    customer = {"requestLang": request_lang}
    if customer_email:
        customer["email"] = customer_email
    if customer_name:
        customer["fullName"] = customer_name
    if len(customer) > 1:
        payload["customer"] = customer

    token = await _viva_access_token()
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            f"{_viva_api_base()}/checkout/v2/orders",
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        if (
            res.status_code == 403
            and source_code.lower() != "default"
            and "does not have a source with code" in res.text.lower()
        ):
            payload["sourceCode"] = "Default"
            res = await client.post(
                f"{_viva_api_base()}/checkout/v2/orders",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        if res.status_code >= 400:
            detail = res.text[:500]
            raise ValueError(f"Viva order creation failed ({res.status_code}): {detail}")
        data = res.json()

    order_code = data.get("orderCode")
    if not order_code:
        raise ValueError("Viva order response missing orderCode.")

    return {
        "orderCode": str(order_code),
        "checkoutUrl": f"{_viva_checkout_base()}?ref={order_code}",
        "plan": plan_key,
        "amount": plan["amount"],
        "label": label,
    }
