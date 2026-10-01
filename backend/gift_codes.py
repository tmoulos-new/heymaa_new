"""Redeemable gift codes: free plan days and/or bonus points."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

_MISSING = (
    "Gift tables are missing. Run backend/migrations/gift_codes.sql "
    "in the Supabase SQL editor, then try again."
)
_CODE_RE = re.compile(r"^[A-Za-z0-9\-_]{4,40}$")


def _main():
    try:
        from . import main as m
    except ImportError:
        import main as m
    return m


def _require_admin(token: Optional[str]) -> str:
    m = _main()
    if not m.ensure_supabase():
        raise HTTPException(status_code=503, detail="Database not configured")
    return str(m.verify_admin(token))


def _require_user(token: Optional[str]) -> str:
    m = _main()
    if not m.ensure_supabase():
        raise HTTPException(status_code=503, detail="Database not configured")
    auth = m.resolve_auth(token or "", context="app")
    if auth.get("kind") != "user" or not auth.get("user_id"):
        raise HTTPException(status_code=401, detail="Sign in to claim this gift.")
    return str(auth["user_id"])


def _missing_table(exc: Exception) -> bool:
    text = str(exc).lower()
    return "gift_code" in text or "gift_claim" in text or "42p01" in text or "does not exist" in text


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def normalize_gift_code(code: Optional[str]) -> str:
    return re.sub(r"\s+", "", (code or "").strip().upper())


def suggest_gift_code() -> str:
    return f"GIFT-{secrets.token_hex(3).upper()}"


def _normalize_status(status: Optional[str]) -> str:
    raw = (status or "active").strip().lower()
    if raw not in ("active", "inactive", "expired"):
        raise HTTPException(status_code=400, detail="status must be active, inactive, or expired")
    return raw


def _validate_reward_fields(
    *,
    gift_type: str,
    plan_slot: Optional[str],
    days: Optional[int],
    points: Optional[int],
) -> dict[str, Any]:
    gtype = (gift_type or "").strip().lower()
    if gtype not in ("free_plan_days", "bonus_points", "combo"):
        raise HTTPException(
            status_code=400,
            detail="gift_type must be free_plan_days, bonus_points, or combo",
        )
    slot = (plan_slot or "").strip().lower() or None
    days_i = int(days) if days is not None else None
    points_i = int(points) if points is not None else None

    if gtype in ("free_plan_days", "combo"):
        if slot not in ("starter", "premium"):
            raise HTTPException(status_code=400, detail="Choose starter or premium for plan days.")
        if not days_i or days_i < 1 or days_i > 365:
            raise HTTPException(status_code=400, detail="Days must be between 1 and 365.")
    else:
        slot = None
        days_i = None

    if gtype in ("bonus_points", "combo"):
        if not points_i or points_i < 1 or points_i > 100000:
            raise HTTPException(status_code=400, detail="Points must be between 1 and 100000.")
    else:
        points_i = None

    return {
        "gift_type": gtype,
        "plan_slot": slot,
        "days": days_i,
        "points": points_i,
    }


def _public_gift_view(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "code": row.get("code"),
        "gift_type": row.get("gift_type"),
        "plan_slot": row.get("plan_slot"),
        "days": row.get("days"),
        "points": row.get("points"),
        "label": row.get("label"),
        "status": row.get("status"),
        "expires_at": row.get("expires_at"),
        "max_claims": row.get("max_claims"),
        "claim_count": row.get("claim_count") or 0,
    }


def _lookup_gift(sb, code: str) -> Optional[dict[str, Any]]:
    key = normalize_gift_code(code)
    if not key:
        return None
    for candidate in (key, key.lower(), code.strip()):
        if not candidate:
            continue
        try:
            res = (
                sb.table("gift_codes")
                .select("*")
                .eq("code", candidate)
                .eq("is_deleted", False)
                .limit(1)
                .execute()
            )
            if res.data:
                return res.data[0]
        except Exception:
            continue
    return None


def _gift_validity(row: dict[str, Any]) -> tuple[bool, str]:
    if str(row.get("status") or "") != "active":
        return False, "This gift is not active."
    expires = _parse_dt(row.get("expires_at"))
    if expires and expires <= _utcnow():
        return False, "This gift has expired."
    max_claims = row.get("max_claims")
    claim_count = int(row.get("claim_count") or 0)
    if max_claims is not None and claim_count >= int(max_claims):
        return False, "This gift has already been fully claimed."
    return True, ""


def preview_gift(sb, code: str) -> dict[str, Any]:
    row = _lookup_gift(sb, code)
    if not row:
        raise HTTPException(status_code=404, detail="Gift code not found.")
    ok, reason = _gift_validity(row)
    view = _public_gift_view(row)
    view["claimable"] = ok
    if not ok:
        view["reason"] = reason
    return view


def claim_gift(
    sb,
    user_id: str,
    code: str,
    *,
    award_points: Callable[..., int],
) -> dict[str, Any]:
    row = _lookup_gift(sb, code)
    if not row:
        raise HTTPException(status_code=404, detail="Gift code not found.")
    ok, reason = _gift_validity(row)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    gift_id = row["id"]
    code_key = str(row.get("code") or "")
    try:
        existing = (
            sb.table("gift_claims")
            .select("id")
            .eq("gift_code_id", gift_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise HTTPException(status_code=409, detail="You already claimed this gift.")
    except HTTPException:
        raise
    except Exception as e:
        if _missing_table(e):
            raise HTTPException(status_code=503, detail=_MISSING) from e
        raise

    gtype = str(row.get("gift_type") or "")
    result: dict[str, Any] = {"gift_type": gtype, "code": code_key}
    grant = None
    points_balance = None

    try:
        from plan_grants import append_plan_grant
    except ImportError:
        from .plan_grants import append_plan_grant

    if gtype in ("free_plan_days", "combo"):
        grant = append_plan_grant(
            sb,
            user_id,
            str(row.get("plan_slot") or ""),
            int(row.get("days") or 0),
            source=f"gift:{code_key}",
        )
        result["grant"] = {
            "id": grant.get("id"),
            "plan_slot": grant.get("plan_slot"),
            "days": grant.get("days"),
            "starts_at": grant.get("starts_at"),
            "ends_at": grant.get("ends_at"),
            "upgraded": grant.get("upgraded"),
        }

    if gtype in ("bonus_points", "combo"):
        pts = int(row.get("points") or 0)
        points_balance = award_points(
            user_id,
            pts,
            f"gift:{code_key}",
            "gift",
            "/gift/claim",
        )
        result["points"] = pts
        result["points_balance"] = points_balance

    try:
        sb.table("gift_claims").insert(
            {
                "gift_code_id": gift_id,
                "code": code_key,
                "user_id": user_id,
                "result": result,
            }
        ).execute()
        sb.table("gift_codes").update(
            {
                "claim_count": int(row.get("claim_count") or 0) + 1,
                "updated_at": _utcnow().isoformat(),
            }
        ).eq("id", gift_id).execute()
    except Exception as e:
        if _missing_table(e):
            raise HTTPException(status_code=503, detail=_MISSING) from e
        err = str(e).lower()
        if "duplicate" in err or "unique" in err:
            raise HTTPException(status_code=409, detail="You already claimed this gift.") from e
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {"ok": True, **result, "_gift_row": row}


class GiftCreateRequest(BaseModel):
    code: Optional[str] = None
    gift_type: str = "free_plan_days"
    plan_slot: Optional[str] = None
    days: Optional[int] = None
    points: Optional[int] = None
    label: Optional[str] = None
    notes: Optional[str] = None
    status: str = "active"
    expires_at: Optional[str] = None
    max_claims: Optional[int] = None


class GiftUpdateRequest(BaseModel):
    status: Optional[str] = None
    label: Optional[str] = None
    notes: Optional[str] = None
    expires_at: Optional[str] = None
    max_claims: Optional[int] = Field(default=None)
    clear_max_claims: bool = False
    plan_slot: Optional[str] = None
    days: Optional[int] = None
    points: Optional[int] = None


class GiftClaimRequest(BaseModel):
    code: str


def register_gift_routes(app: FastAPI) -> None:
    @app.get("/admin/gift_codes")
    async def admin_list_gift_codes(
        deleted_only: bool = False,
        x_token: Optional[str] = Header(None),
    ):
        _require_admin(x_token)
        sb = _main().sb
        try:
            query = sb.table("gift_codes").select("*")
            if deleted_only:
                query = query.eq("is_deleted", True)
            else:
                query = query.eq("is_deleted", False)
            res = query.order("created_at", desc=True).limit(200).execute()
        except Exception as e:
            if _missing_table(e):
                return {"gifts": [], "error": _MISSING}
            raise HTTPException(status_code=500, detail=str(e)) from e
        return {"gifts": res.data or []}

    @app.post("/admin/gift_codes")
    async def admin_create_gift_code(req: GiftCreateRequest, x_token: Optional[str] = Header(None)):
        admin_id = _require_admin(x_token)
        sb = _main().sb
        code = normalize_gift_code(req.code) or suggest_gift_code()
        if not _CODE_RE.match(code):
            raise HTTPException(status_code=400, detail="Code must be 4–40 letters, numbers, - or _")
        reward = _validate_reward_fields(
            gift_type=req.gift_type,
            plan_slot=req.plan_slot,
            days=req.days,
            points=req.points,
        )
        status = _normalize_status(req.status)
        max_claims = req.max_claims
        if max_claims is not None and int(max_claims) < 1:
            raise HTTPException(status_code=400, detail="max_claims must be at least 1")
        now = _utcnow().isoformat()
        payload = {
            "code": code,
            "status": status,
            "gift_type": reward["gift_type"],
            "plan_slot": reward["plan_slot"],
            "days": reward["days"],
            "points": reward["points"],
            "label": (req.label or "").strip() or None,
            "notes": (req.notes or "").strip() or None,
            "expires_at": req.expires_at or None,
            "max_claims": int(max_claims) if max_claims is not None else None,
            "claim_count": 0,
            "is_deleted": False,
            "created_by": admin_id,
            "created_at": now,
            "updated_at": now,
        }
        try:
            inserted = sb.table("gift_codes").insert(payload).execute()
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            err = str(e).lower()
            if "duplicate" in err or "unique" in err:
                raise HTTPException(status_code=409, detail="Gift code already exists") from e
            raise HTTPException(status_code=500, detail=str(e)) from e
        row = (inserted.data or [payload])[0]
        try:
            _main()._log_activity(admin_id, "insert", "gift_code", code, value_after=row)
        except Exception:
            pass
        return {"ok": True, "gift": row}

    @app.put("/admin/gift_codes/{code}")
    async def admin_update_gift_code(
        code: str,
        req: GiftUpdateRequest,
        x_token: Optional[str] = Header(None),
    ):
        admin_id = _require_admin(x_token)
        sb = _main().sb
        code_key = normalize_gift_code(code)
        row = _lookup_gift(sb, code_key)
        if not row:
            raise HTTPException(status_code=404, detail="Gift code not found")
        data: dict[str, Any] = {"updated_at": _utcnow().isoformat()}
        if req.status is not None:
            data["status"] = _normalize_status(req.status)
        if req.label is not None:
            data["label"] = req.label.strip() or None
        if req.notes is not None:
            data["notes"] = req.notes.strip() or None
        if req.expires_at is not None:
            data["expires_at"] = req.expires_at or None
        if req.clear_max_claims:
            data["max_claims"] = None
        elif req.max_claims is not None:
            if int(req.max_claims) < 1:
                raise HTTPException(status_code=400, detail="max_claims must be at least 1")
            data["max_claims"] = int(req.max_claims)
        # Allow editing reward fields only if nobody claimed yet.
        reward_touch = req.plan_slot is not None or req.days is not None or req.points is not None
        if reward_touch:
            if int(row.get("claim_count") or 0) > 0:
                raise HTTPException(status_code=400, detail="Cannot change reward after claims started.")
            reward = _validate_reward_fields(
                gift_type=str(row.get("gift_type") or ""),
                plan_slot=req.plan_slot if req.plan_slot is not None else row.get("plan_slot"),
                days=req.days if req.days is not None else row.get("days"),
                points=req.points if req.points is not None else row.get("points"),
            )
            data["plan_slot"] = reward["plan_slot"]
            data["days"] = reward["days"]
            data["points"] = reward["points"]
        if len(data) == 1:
            raise HTTPException(status_code=400, detail="No fields to update")
        try:
            updated = sb.table("gift_codes").update(data).eq("id", row["id"]).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        if not updated.data:
            raise HTTPException(status_code=404, detail="Gift code not found")
        try:
            _main()._log_activity(
                admin_id,
                "update",
                "gift_code",
                code_key,
                value_before=row,
                value_after=updated.data[0],
            )
        except Exception:
            pass
        return {"ok": True, "gift": updated.data[0]}

    @app.delete("/admin/gift_codes/{code}")
    async def admin_delete_gift_code(code: str, x_token: Optional[str] = Header(None)):
        admin_id = _require_admin(x_token)
        sb = _main().sb
        code_key = normalize_gift_code(code)
        row = _lookup_gift(sb, code_key)
        if not row:
            raise HTTPException(status_code=404, detail="Gift code not found")
        try:
            updated = (
                sb.table("gift_codes")
                .update({"is_deleted": True, "updated_at": _utcnow().isoformat()})
                .eq("id", row["id"])
                .execute()
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        try:
            _main()._log_activity(admin_id, "soft_delete", "gift_code", code_key, value_before=row)
        except Exception:
            pass
        return {"ok": True, "gift": (updated.data or [None])[0]}

    @app.post("/admin/gift_codes/{code}/restore")
    async def admin_restore_gift_code(code: str, x_token: Optional[str] = Header(None)):
        admin_id = _require_admin(x_token)
        sb = _main().sb
        code_key = normalize_gift_code(code)
        try:
            res = (
                sb.table("gift_codes")
                .select("*")
                .eq("code", code_key)
                .eq("is_deleted", True)
                .limit(1)
                .execute()
            )
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)) from e
        if not res.data:
            raise HTTPException(status_code=404, detail="Deleted gift code not found")
        row = res.data[0]
        updated = (
            sb.table("gift_codes")
            .update({"is_deleted": False, "updated_at": _utcnow().isoformat()})
            .eq("id", row["id"])
            .execute()
        )
        try:
            _main()._log_activity(admin_id, "restore", "gift_code", code_key, value_after=(updated.data or [row])[0])
        except Exception:
            pass
        return {"ok": True, "gift": (updated.data or [row])[0]}

    @app.get("/gifts/preview")
    async def gifts_preview(code: str = ""):
        m = _main()
        if not m.ensure_supabase():
            raise HTTPException(status_code=503, detail="Database not configured")
        try:
            return {"ok": True, "gift": preview_gift(m.sb, code)}
        except HTTPException:
            raise
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)) from e

    @app.post("/gifts/claim")
    async def gifts_claim(req: GiftClaimRequest, x_token: Optional[str] = Header(None)):
        user_id = _require_user(x_token)
        m = _main()
        try:
            result = claim_gift(m.sb, user_id, req.code, award_points=m._award_points)
        except HTTPException:
            raise
        except Exception as e:
            if _missing_table(e):
                raise HTTPException(status_code=503, detail=_MISSING) from e
            raise HTTPException(status_code=500, detail=str(e)) from e

        gift_row = result.pop("_gift_row", None) if isinstance(result, dict) else None
        try:
            api_key = (getattr(m, "RESEND_API_KEY", "") or "").strip()
            if api_key and gift_row:
                try:
                    from .gift_emails import maybe_send_gift_code_claimed_email
                except ImportError:
                    from gift_emails import maybe_send_gift_code_claimed_email
                maybe_send_gift_code_claimed_email(
                    m.sb,
                    user_id=user_id,
                    gift_type=str(gift_row.get("gift_type") or result.get("gift_type") or ""),
                    plan_slot=gift_row.get("plan_slot"),
                    days=gift_row.get("days"),
                    points=result.get("points") if result.get("points") is not None else gift_row.get("points"),
                    grant=result.get("grant") if isinstance(result.get("grant"), dict) else None,
                    app_url=getattr(m, "APP_URL", "https://www.heymaa.ai"),
                    api_key=api_key,
                    from_address=getattr(m, "RESEND_FROM", "HeyMaa <info@heymaa.ai>"),
                )
        except Exception:
            pass

        status = None
        try:
            if result.get("grant"):
                subscription = {"ok": True, "subscription_active": True}
                subscription.update(m._subscription_status_for_user(user_id))
                auth = m.resolve_auth(x_token or "", context="app")
                status = m.build_status_payload(m.sb, auth, subscription)
        except Exception:
            status = None
        if status:
            result["status"] = status
        return result
