"""HttpOnly session cookies for HeyMaa JWT — reduces XSS token theft vs localStorage."""
from __future__ import annotations

import os
from typing import Optional

from fastapi import Request, Response

SESSION_COOKIE = "hm_session"
REFRESH_COOKIE = "hm_refresh"
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days — access JWT may expire sooner
REFRESH_MAX_AGE = 60 * 60 * 24 * 30  # 30 days — stay signed in on this device


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


def _set_auth_cookie(response: Response, key: str, value: str, max_age: int) -> None:
    response.set_cookie(
        key=key,
        value=value,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        max_age=max_age,
        path="/",
    )


def set_session_cookie(response: Response, token: str) -> None:
    _set_auth_cookie(response, SESSION_COOKIE, token, SESSION_MAX_AGE)


def set_refresh_cookie(response: Response, token: str) -> None:
    _set_auth_cookie(response, REFRESH_COOKIE, token, REFRESH_MAX_AGE)


def refresh_token_from_request(request: Request) -> Optional[str]:
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw and raw.strip():
        return raw.strip()
    return None


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE, path="/")
    response.delete_cookie(key=REFRESH_COOKIE, path="/")
