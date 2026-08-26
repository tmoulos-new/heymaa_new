"""CORS allowlist for HeyMaa API — set CORS_ALLOWED_ORIGINS env (comma-separated) in production."""
from __future__ import annotations

import os

DEFAULT_CORS_ORIGINS = (
    "https://www.heymaa.ai",
    "https://heymaa.ai",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


def cors_allowed_origins() -> list[str]:
    raw = (os.getenv("CORS_ALLOWED_ORIGINS") or "").strip()
    if raw:
        return [part.strip() for part in raw.split(",") if part.strip()]
    return list(DEFAULT_CORS_ORIGINS)
