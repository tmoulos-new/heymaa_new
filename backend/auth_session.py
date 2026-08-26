"""HttpOnly session cookie for HeyMaa JWT — reduces XSS token theft vs localStorage."""
from __future__ import annotations

import os
from typing import Optional

from fastapi import Request, Response

SESSION_COOKIE = "hm_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days — Supabase JWT may expire sooner; client re-auths


def _cookie_secure() -> bool:
    if os.getenv("HM_SESSION_COOKIE_SECURE", "").strip().lower() in {"0", "false", "no"}:
        return False
    if os.getenv("VERCEL") or os.getenv("HM_SESSION_COOKIE_SECURE", "").strip().lower() in {
        "1",
        "true",
        "yes",
    }:
        return True
    return os.getenv("ENV", "").lower() in {"production", "prod"}


def session_token_from_request(request: Request) -> Optional[str]:
    raw = request.cookies.get(SESSION_COOKIE)
    if raw and raw.strip():
        return raw.strip()
    return None


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        max_age=SESSION_MAX_AGE,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE, path="/")
