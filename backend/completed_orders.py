"""ERP feed of completed Viva subscription payments.

Mirrors the babysong `GET /functions/getCompletedOrders?after=&limit=` contract:
incremental sync by `completedAt`, newest-after-cursor, capped page size.
"""
from __future__ import annotations

import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

try:
    from .viva_checkout import (
        VIVA_PLANS,
        _viva_access_token,
        _viva_api_base,
        _viva_www_base,
        viva_configured,
    )
    from .viva_webhook import (
        VIVA_SUCCESS_STATUS_IDS,
        _amount_cents,
        _merchant_basic_credentials,
        _payload_value,
        parse_merchant_trns,
        plan_db_value,
    )
except ImportError:
    from viva_checkout import (
        VIVA_PLANS,
        _viva_access_token,
        _viva_api_base,
        _viva_www_base,
        viva_configured,
    )
    from viva_webhook import (
        VIVA_SUCCESS_STATUS_IDS,
        _amount_cents,
        _merchant_basic_credentials,
        _payload_value,
        parse_merchant_trns,
        plan_db_value,
    )

COMPLETED_ORDERS_TABLE = "completed_orders"
DEFAULT_LIMIT = 60
MAX_LIMIT = 200
DEFAULT_VAT_RATE = 0.24
CURRENCY_CODES = {978: "EUR", 840: "USD", 826: "GBP"}
PLAN_PRODUCTS = {
    "starter": "HeyMaa Starter",
    "premium": "HeyMaa Premium",
    "annual": "HeyMaa Annual Premium",
}


def erp_orders_api_key() -> str:
    return (
        os.getenv("ERP_ORDERS_API_KEY")
        or os.getenv("COMPLETED_ORDERS_API_KEY")
        or ""
    ).strip()


def provided_erp_key(request_headers: dict, query_key: Optional[str] = None) -> str:
    if query_key and str(query_key).strip():
        return str(query_key).strip()
    headers = {str(k).lower(): v for k, v in (request_headers or {}).items()}
    for name in ("x-api-key", "x-erp-key"):
        value = headers.get(name)
        if value:
            return str(value).strip()
    auth = str(headers.get("authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    if auth.lower().startswith("apikey "):
        return auth[7:].strip()
    return ""


def erp_key_authorized(provided: str) -> bool:
    expected = erp_orders_api_key()
    if not expected:
        return True
    if not provided:
        return False
    a = provided.encode("utf-8")
    b = expected.encode("utf-8")
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a, b)


def parse_after_param(raw: Optional[str]) -> datetime:
    text = (raw or "").strip()
    if not text:
        return datetime.now(timezone.utc) - timedelta(days=90)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValueError(f"Invalid after timestamp: {raw}") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def parse_limit_param(raw: Optional[str | int]) -> int:
    if raw is None or raw == "":
        return DEFAULT_LIMIT
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid limit: {raw}") from exc
    if value < 1:
        return 1
    return min(value, MAX_LIMIT)


def vat_rate() -> float:
    raw = (os.getenv("ERP_VAT_RATE") or "").strip()
    if not raw:
        return DEFAULT_VAT_RATE
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_VAT_RATE
    if value < 0 or value > 1:
        return DEFAULT_VAT_RATE
    return value


def split_vat(gross_cents: int, rate: Optional[float] = None) -> tuple[int, int]:
    rate = vat_rate() if rate is None else rate
    gross = max(0, int(gross_cents or 0))
    if rate <= 0:
        return gross, 0
    net = int(round(gross / (1 + rate)))
    return net, gross - net


def _iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    text = str(value).strip()
    if not text:
        return None
    try:
        return _iso(parse_after_param(text))
    except ValueError:
        return text


def _currency(code: Any) -> tuple[str, Optional[int]]:
    if code is None or code == "":
        return "EUR", 978
    try:
        numeric = int(code)
        return CURRENCY_CODES.get(numeric, "EUR"), numeric
    except (TypeError, ValueError):
        text = str(code).strip().upper()
        reverse = {v: k for k, v in CURRENCY_CODES.items()}
        return text or "EUR", reverse.get(text, 978)


def _euros(cents: int) -> float:
    return round(int(cents or 0) / 100.0, 2)


def _is_heymaa_order(merchant_trns: Optional[str], customer_trns: Optional[str], amount_cents: int) -> bool:
    merchant = (merchant_trns or "").strip().lower()
    if merchant.startswith("heymaa:"):
        return True
    customer = (customer_trns or "").lower()
    if "heymaa" in customer:
        return True
    plan_amounts = {int(plan["amount"]) for plan in VIVA_PLANS.values()}
    return amount_cents in plan_amounts and not merchant


def _plan_product(plan_key: Optional[str], customer_trns: Optional[str]) -> str:
    if plan_key and plan_key in PLAN_PRODUCTS:
        return PLAN_PRODUCTS[plan_key]
    if customer_trns:
        return str(customer_trns).strip()
    return "HeyMaa subscription"


def order_from_viva_tx(tx: dict, extra: Optional[dict] = None) -> Optional[dict]:
    extra = extra or {}
    transaction_id = _payload_value(tx, "transactionId", "TransactionId") or extra.get("transactionId")
    if not transaction_id:
        return None

    merchant_trns = _payload_value(tx, "merchantTrns", "MerchantTrns")
    customer_trns = _payload_value(tx, "customerTrns", "CustomerTrns")
    plan_key, parsed_user_id = parse_merchant_trns(
        str(merchant_trns) if merchant_trns is not None else None
    )
    amount_raw = _payload_value(tx, "amount", "Amount")
    if amount_raw is None:
        amount_raw = extra.get("amount")
    amount_cents = _amount_cents(amount_raw)
    if not _is_heymaa_order(
        str(merchant_trns) if merchant_trns is not None else None,
        str(customer_trns) if customer_trns is not None else None,
        amount_cents,
    ):
        return None

    status_id = str(_payload_value(tx, "statusId", "StatusId") or extra.get("statusId") or "F").upper()
    if status_id and status_id not in VIVA_SUCCESS_STATUS_IDS:
        return None

    completed_at = (
        _payload_value(tx, "insDate", "InsDate", "clearanceDate", "ClearanceDate")
        or extra.get("completedAt")
    )
    email = _payload_value(tx, "email", "Email") or extra.get("email")
    full_name = _payload_value(tx, "fullName", "FullName") or extra.get("fullName")
    phone = _payload_value(tx, "phone", "Phone") or extra.get("phone")
    currency, currency_code = _currency(_payload_value(tx, "currencyCode", "CurrencyCode"))
    user_id = extra.get("user_id") or extra.get("userId") or parsed_user_id
    plan = extra.get("plan") or (plan_db_value(plan_key) if plan_key else None)
    net_cents, vat_cents = split_vat(amount_cents)
    address = extra.get("address") if isinstance(extra.get("address"), dict) else {}

    return {
        "id": str(transaction_id),
        "transactionId": str(transaction_id),
        "orderCode": (
            str(_payload_value(tx, "orderCode", "OrderCode") or extra.get("orderCode") or "")
            or None
        ),
        "status": "completed",
        "statusId": status_id,
        "completedAt": _iso(completed_at) or _iso(datetime.now(timezone.utc)),
        "email": str(email).strip().lower() if email else None,
        "fullName": str(full_name).strip() if full_name else None,
        "phone": str(phone).strip() if phone else None,
        "amount": _euros(amount_cents),
        "amountCents": amount_cents,
        "currency": currency,
        "currencyCode": currency_code,
        "vatRate": vat_rate(),
        "netAmount": _euros(net_cents),
        "vatAmount": _euros(vat_cents),
        "plan": plan,
        "product": _plan_product(plan, customer_trns if isinstance(customer_trns, str) else None),
        "description": str(customer_trns).strip() if customer_trns else _plan_product(plan, None),
        "customerTrns": str(customer_trns).strip() if customer_trns else None,
        "merchantTrns": str(merchant_trns).strip() if merchant_trns else None,
        "userId": str(user_id) if user_id else None,
        "address": {
            "street": address.get("street") or extra.get("address_street"),
            "number": address.get("number") or extra.get("address_number"),
            "zip": address.get("zip") or extra.get("address_zip"),
            "city": address.get("city") or extra.get("address_city"),
            "country": address.get("country") or extra.get("address_country") or "GR",
        },
    }


def order_to_row(order: dict) -> dict:
    address = order.get("address") or {}
    return {
        "transaction_id": order.get("transactionId") or order.get("id"),
        "order_code": order.get("orderCode"),
        "status": order.get("status") or "completed",
        "status_id": order.get("statusId"),
        "completed_at": order.get("completedAt"),
        "email": order.get("email"),
        "full_name": order.get("fullName"),
        "phone": order.get("phone"),
        "amount_cents": order.get("amountCents") or 0,
        "currency": order.get("currency") or "EUR",
        "currency_code": order.get("currencyCode") or 978,
        "plan": order.get("plan"),
        "product": order.get("product"),
        "customer_trns": order.get("customerTrns"),
        "merchant_trns": order.get("merchantTrns"),
        "user_id": order.get("userId"),
        "address_street": address.get("street"),
        "address_number": address.get("number"),
        "address_zip": address.get("zip"),
        "address_city": address.get("city"),
        "address_country": address.get("country"),
        "raw": {
            "description": order.get("description"),
            "vatRate": order.get("vatRate"),
        },
    }


def row_to_order(row: dict) -> dict:
    amount_cents = int(row.get("amount_cents") or 0)
    net_cents, vat_cents = split_vat(amount_cents)
    raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
    return {
        "id": row.get("transaction_id"),
        "transactionId": row.get("transaction_id"),
        "orderCode": row.get("order_code"),
        "status": row.get("status") or "completed",
        "statusId": row.get("status_id") or "F",
        "completedAt": _iso(row.get("completed_at")),
        "email": row.get("email"),
        "fullName": row.get("full_name"),
        "phone": row.get("phone"),
        "amount": _euros(amount_cents),
        "amountCents": amount_cents,
        "currency": row.get("currency") or "EUR",
        "currencyCode": row.get("currency_code") or 978,
        "vatRate": raw.get("vatRate", vat_rate()),
        "netAmount": _euros(net_cents),
        "vatAmount": _euros(vat_cents),
        "plan": row.get("plan"),
        "product": row.get("product") or _plan_product(row.get("plan"), row.get("customer_trns")),
        "description": raw.get("description") or row.get("customer_trns") or row.get("product"),
        "customerTrns": row.get("customer_trns"),
        "merchantTrns": row.get("merchant_trns"),
        "userId": str(row["user_id"]) if row.get("user_id") else None,
        "address": {
            "street": row.get("address_street"),
            "number": row.get("address_number"),
            "zip": row.get("address_zip"),
            "city": row.get("address_city"),
            "country": row.get("address_country") or "GR",
        },
    }


def _extract_tx_list(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("items", "Items", "data", "Data", "transactions", "Transactions", "results", "Results"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = _extract_tx_list(value)
            if nested:
                return nested
    return []


def _legacy_fromdate(after: datetime) -> str:
    return after.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


async def search_viva_transactions(after: datetime, limit: int) -> list[dict]:
    if not viva_configured():
        return []
    ins_from = after.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    token = await _viva_access_token()
    headers = {"Authorization": f"Bearer {token}"}
    page_size = min(max(limit, 1), MAX_LIMIT)
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(
            f"{_viva_api_base()}/dataservices/v2/transactions/Search",
            headers=headers,
            params={
                "PageSize": page_size,
                "Page": 1,
                "OrderBy": "Ascending",
                "insDateFrom": ins_from,
            },
        )
        if res.status_code < 400:
            found = _extract_tx_list(res.json())
            if found:
                return found

        creds = _merchant_basic_credentials()
        if not creds:
            return []
        legacy = await client.get(
            f"{_viva_www_base()}/api/transactions",
            auth=creds,
            params={
                "fromdate": _legacy_fromdate(after),
                "todate": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            },
        )
        if legacy.status_code >= 400:
            return []
        return _extract_tx_list(legacy.json())


def upsert_completed_order(sb, order: dict) -> None:
    if not sb or not order or not order.get("transactionId"):
        return
    sb.table(COMPLETED_ORDERS_TABLE).upsert(
        order_to_row(order),
        on_conflict="transaction_id",
    ).execute()


def _profile_enrichment(sb, user_id: Optional[str], email: Optional[str]) -> dict:
    extra: dict[str, Any] = {}
    if not sb:
        return extra
    row = None
    if user_id:
        res = sb.table("users").select("id,email,name").eq("id", user_id).limit(1).execute()
        if res.data:
            row = res.data[0]
    if not row and email:
        res = (
            sb.table("users")
            .select("id,email,name")
            .eq("email", email.strip().lower())
            .limit(1)
            .execute()
        )
        if res.data:
            row = res.data[0]
    if not row:
        return extra
    extra["user_id"] = row.get("id")
    extra["email"] = row.get("email") or email
    extra["fullName"] = row.get("name")
    try:
        prof = (
            sb.table("profiles")
            .select("name,address_street,address_number,address_zip,address_city,address_country")
            .eq("user_id", row["id"])
            .limit(1)
            .execute()
        )
        if prof.data:
            p = prof.data[0]
            extra["fullName"] = extra.get("fullName") or p.get("name")
            extra["address"] = {
                "street": p.get("address_street"),
                "number": p.get("address_number"),
                "zip": p.get("address_zip"),
                "city": p.get("address_city"),
                "country": p.get("address_country") or "GR",
            }
    except Exception:
        pass
    try:
        phone = (
            sb.table("user_data")
            .select("value")
            .eq("user_id", row["id"])
            .eq("key", "phone")
            .limit(1)
            .execute()
        )
        if phone.data:
            extra["phone"] = phone.data[0].get("value")
    except Exception:
        pass
    return extra


def persist_completed_order(sb, tx: dict, extra: Optional[dict] = None) -> Optional[dict]:
    extra = dict(extra or {})
    try:
        extra.update(
            _profile_enrichment(
                sb,
                extra.get("user_id") or extra.get("userId"),
                extra.get("email") or _payload_value(tx, "email", "Email"),
            )
        )
    except Exception:
        pass
    order = order_from_viva_tx(tx, extra)
    if not order:
        return None
    try:
        upsert_completed_order(sb, order)
    except Exception:
        pass
    return order


def list_stored_orders(sb, after: datetime, limit: int) -> list[dict]:
    if not sb:
        return []
    after_iso = after.astimezone(timezone.utc).isoformat()
    res = (
        sb.table(COMPLETED_ORDERS_TABLE)
        .select("*")
        .eq("status", "completed")
        .gt("completed_at", after_iso)
        .order("completed_at", desc=False)
        .limit(limit)
        .execute()
    )
    return [row_to_order(row) for row in (res.data or [])]


def _sort_orders(orders: list[dict]) -> list[dict]:
    return sorted(orders, key=lambda item: (item.get("completedAt") or "", item.get("id") or ""))


def merge_orders(*groups: list[dict]) -> list[dict]:
    by_id: dict[str, dict] = {}
    for group in groups:
        for order in group:
            oid = str(order.get("id") or "")
            if not oid:
                continue
            existing = by_id.get(oid)
            if not existing:
                by_id[oid] = order
                continue
            merged = dict(existing)
            for key, value in order.items():
                if value in (None, "", {}, []):
                    continue
                if key == "address" and isinstance(value, dict):
                    addr = dict(merged.get("address") or {})
                    addr.update({k: v for k, v in value.items() if v})
                    merged["address"] = addr
                else:
                    merged[key] = value
            by_id[oid] = merged
    return _sort_orders(list(by_id.values()))


async def get_completed_orders(sb, after: datetime, limit: int) -> list[dict]:
    stored: list[dict] = []
    try:
        stored = list_stored_orders(sb, after, limit)
    except Exception:
        stored = []

    viva_orders: list[dict] = []
    try:
        for tx in await search_viva_transactions(after, limit):
            extra = _profile_enrichment(
                sb,
                None,
                _payload_value(tx, "email", "Email"),
            )
            order = persist_completed_order(sb, tx, extra) or order_from_viva_tx(tx, extra)
            if order:
                viva_orders.append(order)
    except Exception:
        viva_orders = []

    merged = merge_orders(stored, viva_orders)
    after_iso = after.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    filtered = [
        order
        for order in merged
        if (order.get("completedAt") or "") > after_iso
    ]
    return filtered[:limit]
