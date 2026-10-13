"""Private user-media Storage helpers (chat Library + memory videos/photos)."""
from __future__ import annotations

import base64
import re
import uuid
from typing import Optional

USER_MEDIA_BUCKET = "user-media"
MAX_USER_MEDIA_BYTES = 16 * 1024 * 1024
SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7  # 7 days

ALLOWED_USER_MEDIA_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/pdf",
    "application/octet-stream",
    "text/plain",
}

_EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "application/pdf": "pdf",
    "application/octet-stream": "bin",
    "text/plain": "txt",
}

_DATA_URL_RE = re.compile(r"^data:([^;]+);base64,(.+)$", re.DOTALL | re.IGNORECASE)


def normalize_content_type(raw: Optional[str]) -> str:
    ct = (raw or "").split(";")[0].strip().lower()
    if ct in ALLOWED_USER_MEDIA_TYPES:
        return ct
    if ct.startswith("image/"):
        return "image/jpeg"
    if ct.startswith("video/"):
        return "video/mp4"
    return "application/octet-stream"


def parse_data_url(data_url: str) -> tuple[bytes, str]:
    m = _DATA_URL_RE.match((data_url or "").strip())
    if not m:
        raise ValueError("invalid_data_url")
    content_type = normalize_content_type(m.group(1))
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except Exception as exc:
        raise ValueError("invalid_base64") from exc
    return raw, content_type


def user_media_key(user_id: str, kind: str, content_type: str, media_id: Optional[str] = None) -> str:
    safe_kind = "chat" if kind == "chat" else "memory"
    stem = re.sub(r"[^a-zA-Z0-9_-]", "", (media_id or ""))[:48] or uuid.uuid4().hex
    ext = _EXT.get(content_type, "bin")
    return f"{user_id}/{safe_kind}/{stem}.{ext}"


def assert_owns_key(user_id: str, key: str) -> str:
    cleaned = (key or "").strip().lstrip("/")
    prefix = f"{user_id}/"
    if not cleaned.startswith(prefix) or ".." in cleaned:
        raise PermissionError("forbidden_key")
    return cleaned


def upload_user_media_bytes(sb, *, user_id: str, kind: str, data: bytes, content_type: str, media_id: Optional[str] = None) -> dict:
    if not sb:
        raise RuntimeError("storage_unavailable")
    if not data:
        raise ValueError("empty_file")
    if len(data) > MAX_USER_MEDIA_BYTES:
        raise ValueError("too_large")
    ct = normalize_content_type(content_type)
    if ct not in ALLOWED_USER_MEDIA_TYPES:
        raise ValueError("unsupported_type")
    key = user_media_key(user_id, kind, ct, media_id)
    sb.storage.from_(USER_MEDIA_BUCKET).upload(
        key,
        data,
        {"content-type": ct, "upsert": "true"},
    )
    return {"key": key, "content_type": ct, "bytes": len(data)}


def create_signed_user_media_url(sb, *, user_id: str, key: str, expires_in: int = SIGNED_URL_TTL_SEC) -> Optional[str]:
    if not sb:
        return None
    owned = assert_owns_key(user_id, key)
    res = sb.storage.from_(USER_MEDIA_BUCKET).create_signed_url(owned, expires_in)
    if isinstance(res, dict):
        return res.get("signedURL") or res.get("signedUrl") or res.get("signed_url")
    return getattr(res, "signed_url", None) or getattr(res, "signedURL", None)


def delete_user_media(sb, *, user_id: str, key: str) -> None:
    if not sb:
        return
    owned = assert_owns_key(user_id, key)
    sb.storage.from_(USER_MEDIA_BUCKET).remove([owned])
