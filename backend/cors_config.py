"""CORS allowlist for HeyMaa API — set CORS_ALLOWED_ORIGINS env (comma-separated) in production."""
from __future__ import annotations

import os

DEFAULT_CORS_ORIGINS = (
    "https://www.heymaa.ai",
    "https://heymaa.ai",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
)

# CRA/Vite often bind an alternate port (3002, 5174). Keep local regex unless
# production overrides CORS_ALLOWED_ORIGINS.
DEFAULT_CORS_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"


def cors_allowed_origins() -> list[str]:
    raw = (os.getenv("CORS_ALLOWED_ORIGINS") or "").strip()
    origins = [part.strip() for part in raw.split(",") if part.strip()] if raw else []
    if not origins:
        origins = list(DEFAULT_CORS_ORIGINS)
    else:
        for origin in DEFAULT_CORS_ORIGINS:
            if origin not in origins:
                origins.append(origin)
    return origins


def cors_allowed_origin_regex() -> str | None:
    raw = (os.getenv("CORS_ALLOWED_ORIGIN_REGEX") or "").strip()
    if raw:
        return raw
    return DEFAULT_CORS_ORIGIN_REGEX
