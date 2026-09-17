"""Transactional emails for level-up gifts (won + claimed)."""
from __future__ import annotations

from typing import Any, Optional

try:
    from .email_templates import (
        normalize_email_lang,
        render_level_gift_activated_email,
        render_level_gift_won_email,
        send_email,
    )
    from .plan_grants import get_claimed_level_ids, load_level_reward_grants
except ImportError:
    from email_templates import (
        normalize_email_lang,
        render_level_gift_activated_email,
        render_level_gift_won_email,
        send_email,
    )
    from plan_grants import get_claimed_level_ids, load_level_reward_grants

GIFT_WON_MAIL_PREFIX = "gift_won_mail_"


def newly_unlocked_gifts(
    from_level: int,
    to_level: int,
    mapping: dict[int, dict[str, Any]],
    claimed: set[int],
    already_mailed: Optional[set[int]] = None,
) -> list[dict[str, Any]]:
    mailed = already_mailed or set()
    gifts: list[dict[str, Any]] = []
    for lid in sorted(mapping.keys()):
        if lid <= from_level or lid > to_level:
            continue
        if lid in claimed or lid in mailed:
            continue
        cfg = mapping.get(lid) or {}
        days = int(cfg.get("days") or 0)
        slot = str(cfg.get("plan_slot") or "").strip().lower()
        if days < 1 or slot not in ("starter", "premium"):
            continue
        gifts.append({"level_id": lid, "days": days, "plan_slot": slot})
    return gifts


def _read_profile_lang(sb, user_id: str) -> str:
    try:
        res = (
            sb.table("user_data")
            .select("value")
            .eq("user_id", user_id)
            .eq("key", "profile")
            .limit(1)
            .execute()
        )
        if not res.data:
            return "el"
        raw = res.data[0].get("value")
        if isinstance(raw, dict):
            return normalize_email_lang(str(raw.get("lang") or "el"))
        if isinstance(raw, str) and raw.strip().startswith("{"):
            import json
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return normalize_email_lang(str(parsed.get("lang") or "el"))
    except Exception:
        pass
    return "el"


def _load_user_contact(sb, user_id: str) -> tuple[str, Optional[str], str]:
    email = ""
    name = None
    try:
        res = (
            sb.table("users")
            .select("email,name")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if res.data:
            email = str(res.data[0].get("email") or "").strip().lower()
            name = res.data[0].get("name")
    except Exception:
        pass
    return email, name, _read_profile_lang(sb, user_id)


def _gift_won_key(level_id: int) -> str:
    return f"{GIFT_WON_MAIL_PREFIX}{int(level_id)}"


def _already_mailed_won(sb, user_id: str, level_ids: list[int]) -> set[int]:
    mailed: set[int] = set()
    if not sb or not user_id or not level_ids:
        return mailed
    try:
        keys = [_gift_won_key(lid) for lid in level_ids]
        res = (
            sb.table("user_data")
            .select("key")
            .eq("user_id", user_id)
            .in_("key", keys)
            .execute()
        )
        for row in res.data or []:
            key = str(row.get("key") or "")
            if key.startswith(GIFT_WON_MAIL_PREFIX):
                try:
                    mailed.add(int(key[len(GIFT_WON_MAIL_PREFIX) :]))
                except Exception:
                    continue
    except Exception:
        pass
    return mailed


def _mark_won_mailed(sb, user_id: str, level_ids: list[int]) -> None:
    if not sb or not user_id:
        return
    for lid in level_ids:
        try:
            sb.table("user_data").upsert(
                {"user_id": user_id, "key": _gift_won_key(lid), "value": True},
                on_conflict="user_id,key",
            ).execute()
        except Exception:
            try:
                existing = (
                    sb.table("user_data")
                    .select("key")
                    .eq("user_id", user_id)
                    .eq("key", _gift_won_key(lid))
                    .limit(1)
                    .execute()
                )
                if existing.data:
                    continue
                sb.table("user_data").insert(
                    {"user_id": user_id, "key": _gift_won_key(lid), "value": True}
                ).execute()
            except Exception:
                continue


def _level_name(level_rows: Optional[dict[int, dict[str, Any]]], level_id: int, lang: str) -> str:
    row = (level_rows or {}).get(int(level_id)) or {}
    if lang == "en":
        return str(row.get("name_en") or "").strip()
    return str(row.get("name_el") or row.get("name_en") or "").strip()


def maybe_send_gift_won_email(
    sb,
    *,
    user_id: str,
    from_level: int,
    to_level: int,
    level_rows: Optional[dict[int, dict[str, Any]]] = None,
    app_url: str,
    api_key: str,
    from_address: str,
) -> bool:
    if not sb or not user_id or not api_key or to_level <= from_level:
        return False
    mapping = load_level_reward_grants(sb)
    claimed = get_claimed_level_ids(sb, user_id)
    candidates = newly_unlocked_gifts(from_level, to_level, mapping, claimed)
    if not candidates:
        return False
    mailed = _already_mailed_won(sb, user_id, [g["level_id"] for g in candidates])
    gifts = newly_unlocked_gifts(from_level, to_level, mapping, claimed, mailed)
    if not gifts:
        return False

    email, name, lang = _load_user_contact(sb, user_id)
    if not email or "@" not in email:
        return False
    for gift in gifts:
        gift["level_name"] = _level_name(level_rows, gift["level_id"], lang)
    top = gifts[-1]
    try:
        msg = render_level_gift_won_email(
            name=name,
            gifts=gifts,
            level_name=_level_name(level_rows, int(top["level_id"]), lang),
            app_url=app_url,
            lang=lang,
        )
        err = send_email(
            api_key=api_key,
            from_address=from_address,
            to=email,
            message=msg,
        )
        if err:
            return False
        _mark_won_mailed(sb, user_id, [int(g["level_id"]) for g in gifts])
        return True
    except Exception:
        return False


def maybe_send_gift_activated_email(
    sb,
    *,
    user_id: str,
    grant: Optional[dict[str, Any]],
    level_rows: Optional[dict[int, dict[str, Any]]] = None,
    app_url: str,
    api_key: str,
    from_address: str,
) -> bool:
    if not sb or not user_id or not api_key or not grant:
        return False
    email, name, lang = _load_user_contact(sb, user_id)
    if not email or "@" not in email:
        return False
    level_id = int(grant.get("level_id") or 0)
    try:
        msg = render_level_gift_activated_email(
            name=name,
            days=int(grant.get("days") or 0),
            plan_slot=str(grant.get("plan_slot") or "starter"),
            level_name=_level_name(level_rows, level_id, lang) if level_id else "",
            upgraded=bool(grant.get("upgraded")),
            starts_at=grant.get("starts_at"),
            ends_at=grant.get("ends_at"),
            app_url=app_url,
            lang=lang,
        )
        err = send_email(
            api_key=api_key,
            from_address=from_address,
            to=email,
            message=msg,
        )
        return err is None
    except Exception:
        return False
