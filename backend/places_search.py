"""Google Places (Maps) text search for HeyMaa local recommendations.

Uses the Places API (New) Text Search endpoint with ``Google_Maps_API`` /
``GOOGLE_MAPS_API_KEY``. Results are injected into the chat system prompt so
any model can recommend real places without inventing them.
"""
from __future__ import annotations

import os
import re
from typing import Any, Optional

import requests

_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
_FIELD_MASK = (
    "places.displayName,places.formattedAddress,places.shortFormattedAddress,"
    "places.rating,places.userRatingCount,places.googleMapsUri,places.types,"
    "places.nationalPhoneNumber"
)


def google_maps_api_key() -> str:
    for name in (
        "Google_Maps_API",
        "GOOGLE_MAPS_API",
        "GOOGLE_MAPS_API_KEY",
        "MAPS_API_KEY",
    ):
        val = (os.getenv(name) or "").strip().strip('"').strip("'")
        if val:
            return val
    return ""


def _display_name(place: dict[str, Any]) -> str:
    dn = place.get("displayName") or {}
    if isinstance(dn, dict):
        return (dn.get("text") or "").strip()
    return str(dn or "").strip()


def build_places_search_query(
    message: str,
    *,
    location_hint: str = "",
) -> str:
    """Build a Text Search query from the user message + optional city/country."""
    text = re.sub(r"\s+", " ", (message or "").strip())
    # Drop soft greetings so Places focuses on the place request.
    text = re.sub(
        r"^(καλησπέρα|καλημερα|γειά σου|γεια σου|γεια|hi|hello|hey)[\s,!.]*",
        "",
        text,
        flags=re.I,
    ).strip()
    text = re.sub(
        r"^(μπορείς να|μπορεις να|can you|could you)\s+",
        "",
        text,
        flags=re.I,
    ).strip()
    hint = (location_hint or "").strip()
    if hint:
        folded = text.casefold()
        if hint.casefold() not in folded and not any(
            part and part.casefold() in folded for part in re.split(r"[,\s]+", hint) if len(part) > 3
        ):
            text = f"{text} {hint}".strip()
    return text[:200] or (hint or "pediatrician")


def search_places_text(
    query: str,
    *,
    language_code: str = "el",
    max_results: int = 8,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    api_key: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Call Places Text Search. Returns normalized place dicts (may be empty)."""
    key = (api_key or google_maps_api_key()).strip()
    q = (query or "").strip()
    if not key or not q:
        return []
    body: dict[str, Any] = {
        "textQuery": q,
        "languageCode": (language_code or "el")[:8],
        "pageSize": max(1, min(int(max_results or 8), 12)),
    }
    if latitude is not None and longitude is not None:
        try:
            body["locationBias"] = {
                "circle": {
                    "center": {"latitude": float(latitude), "longitude": float(longitude)},
                    "radius": 8000.0,
                }
            }
        except (TypeError, ValueError):
            pass
    try:
        r = requests.post(
            _PLACES_URL,
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": _FIELD_MASK,
            },
            json=body,
            timeout=20,
        )
    except Exception:
        return []
    if not r.ok:
        return []
    try:
        data = r.json() or {}
    except Exception:
        return []
    out: list[dict[str, Any]] = []
    for place in data.get("places") or []:
        if not isinstance(place, dict):
            continue
        name = _display_name(place)
        if not name:
            continue
        out.append(
            {
                "name": name,
                "address": (
                    (place.get("shortFormattedAddress") or place.get("formattedAddress") or "")
                    .strip()
                ),
                "rating": place.get("rating"),
                "ratings_count": place.get("userRatingCount"),
                "maps_url": (place.get("googleMapsUri") or "").strip(),
                "phone": (place.get("nationalPhoneNumber") or "").strip(),
                "types": [str(t) for t in (place.get("types") or []) if t][:6],
            }
        )
    return out


def format_places_for_prompt(places: list[dict[str, Any]]) -> str:
    if not places:
        return ""
    lines = [
        "Place search results from Google Places (recommend ONLY from this list; "
        "do not invent places, ratings, phones, or addresses):"
    ]
    for i, p in enumerate(places, 1):
        bit = f"{i}. {p.get('name') or 'Place'}"
        if p.get("address"):
            bit += f" — {p['address']}"
        rating = p.get("rating")
        count = p.get("ratings_count")
        if rating is not None:
            bit += f" — rating {rating}"
            if count is not None:
                bit += f" ({count} reviews)"
        if p.get("phone"):
            bit += f" — phone {p['phone']}"
        if p.get("maps_url"):
            bit += f" — maps: {p['maps_url']}"
        lines.append(bit)
    lines.append(
        "Pick the 3–6 that best match her request. Confirm hours/availability may change. "
        "This is directory help, not medical advice."
    )
    return "\n".join(lines)
