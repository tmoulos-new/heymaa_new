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

from urllib.parse import quote_plus


_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,"
    "places.rating,places.userRatingCount,places.googleMapsUri,places.types,"
    "places.nationalPhoneNumber,places.location"
)

# Common Greek spelling mistakes that break Places search / map intent
_PLACE_QUERY_FIXES = (
    (re.compile(r"παλα[ιί]?ο\s*φ[αά]ληρ[οο]?υ?", re.I), "Παλαιό Φάληρο"),
    (re.compile(r"ν[εέ]ο\s*φ[αά]ληρ[οο]?υ?", re.I), "Νέο Φάληρο"),
    (re.compile(r"ηλιο[υύ]πολ", re.I), "Ηλιούπολη"),
    (re.compile(r"καλλιθ[εέ]α", re.I), "Καλλιθέα"),
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


def stable_maps_url(
    *,
    name: str = "",
    address: str = "",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    place_id: str = "",
    fallback: str = "",
) -> str:
    """
    Build a Maps URL that reliably opens the place.

    Places API ``googleMapsUri`` often looks like ``maps.google.com/?cid=…&g_mp=…``
    and opens a blank map in many browsers — prefer lat/lng or text search.
    """
    if lat is not None and lng is not None:
        try:
            return (
                "https://www.google.com/maps/search/?api=1&query="
                f"{float(lat)}%2C{float(lng)}"
            )
        except (TypeError, ValueError):
            pass
    pid = (place_id or "").strip()
    if pid.startswith("places/"):
        pid = pid.split("/", 1)[-1]
    if pid and re.match(r"^ChIJ[\w-]+$", pid):
        return f"https://www.google.com/maps/place/?q=place_id:{pid}"
    q = " ".join(x for x in ((name or "").strip(), (address or "").strip()) if x)
    if q:
        return f"https://www.google.com/maps/search/?api=1&query={quote_plus(q)}"
    fb = (fallback or "").strip()
    # Drop known-bad cid/g_mp-only links
    if fb and "g_mp=" in fb and "query=" not in fb and "/maps/place" not in fb:
        return ""
    return fb


def rewrite_reply_place_links(reply: str, places: list[dict[str, Any]]) -> str:
    """Force markdown place links to use our stable Maps URLs (never invent / cid junk)."""
    text = reply or ""
    if not text or not places:
        return text

    def _norm(s: str) -> str:
        return re.sub(r"\s+", " ", (s or "").casefold()).strip()

    # Longest names first so partial overlaps prefer the full venue name
    ordered = sorted(
        [p for p in places if (p.get("name") or "").strip() and (p.get("maps_url") or "").strip()],
        key=lambda p: len(p.get("name") or ""),
        reverse=True,
    )

    def repl_md(m: re.Match) -> str:
        label = m.group(1)
        href = m.group(2)
        nlabel = _norm(label)
        for p in ordered:
            pname = _norm(p.get("name") or "")
            if not pname:
                continue
            if pname == nlabel or pname in nlabel or nlabel in pname:
                return f"[{label}]({p['maps_url']})"
        # Rewrite generic broken cid links even without a name match if only one place
        if "g_mp=" in href or re.search(r"[?&]cid=\d+", href):
            if len(ordered) == 1:
                return f"[{label}]({ordered[0]['maps_url']})"
        return m.group(0)

    text = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", repl_md, text)

    # Unlinked bold names → linked
    for p in ordered:
        name = (p.get("name") or "").strip()
        url = (p.get("maps_url") or "").strip()
        if not name or not url:
            continue
        esc = re.escape(name)

        def bold_repl(m: re.Match, _url: str = url, _name: str = name) -> str:
            # Skip if this bold run is already a markdown link label
            return f"**[{_name}]({_url})**"

        text = re.sub(rf"\*\*{esc}\*\*(?!\()", bold_repl, text, flags=re.I)
    return text


def build_places_search_query(
    message: str,
    *,
    location_hint: str = "",
) -> str:
    """Build a Text Search query from the user message + optional city/country."""
    text = re.sub(r"\s+", " ", (message or "").strip())
    for pat, repl in _PLACE_QUERY_FIXES:
        text = pat.sub(repl, text)
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
        loc = place.get("location") if isinstance(place.get("location"), dict) else {}
        lat = loc.get("latitude")
        lng = loc.get("longitude")
        try:
            lat_f = float(lat) if lat is not None else None
            lng_f = float(lng) if lng is not None else None
        except (TypeError, ValueError):
            lat_f, lng_f = None, None
        address = (
            (place.get("shortFormattedAddress") or place.get("formattedAddress") or "")
            .strip()
        )
        place_id = (place.get("id") or "").strip()
        raw_maps = (place.get("googleMapsUri") or "").strip()
        maps = stable_maps_url(
            name=name,
            address=address,
            lat=lat_f,
            lng=lng_f,
            place_id=place_id,
            fallback=raw_maps,
        )
        out.append(
            {
                "name": name,
                "address": address,
                "rating": place.get("rating"),
                "ratings_count": place.get("userRatingCount"),
                "maps_url": maps,
                "phone": (place.get("nationalPhoneNumber") or "").strip(),
                "types": [str(t) for t in (place.get("types") or []) if t][:6],
                "lat": lat_f,
                "lng": lng_f,
                "place_id": place_id or None,
            }
        )
    return out


def places_for_client(places: list[dict[str, Any]], *, limit: int = 8) -> list[dict[str, Any]]:
    """Sanitize Places results for the chat UI (map pins + links)."""
    out: list[dict[str, Any]] = []
    for p in places[: max(1, min(int(limit or 8), 12))]:
        name = (p.get("name") or "").strip()
        if not name:
            continue
        item: dict[str, Any] = {
            "name": name,
            "address": (p.get("address") or "").strip() or None,
            "rating": p.get("rating"),
            "maps_url": (p.get("maps_url") or "").strip() or None,
            "lat": p.get("lat"),
            "lng": p.get("lng"),
        }
        out.append(item)
    return out


def format_places_for_prompt(places: list[dict[str, Any]]) -> str:
    if not places:
        return ""
    lines = [
        "Place search results from Google Places (recommend ONLY from this list; "
        "do not invent places, ratings, phones, or addresses):",
        "",
        "Format your reply like this (markdown — the app renders it):",
        "1) One short intro sentence.",
        "2) A bullet list (- ), one place per bullet.",
        "3) Each bullet: **[Name](maps_url)** — address · ★ rating (N reviews) when available.",
        "   Copy the maps_url EXACTLY from the Results list (do not invent or shorten URLs).",
        "   If maps_url is missing, still bold the name: **Name** — address …",
        "4) One short closing note (hours may change; not medical advice when relevant).",
        "Do not dump raw 'maps: https://…' text — always use markdown links on the name.",
        "Never invent Google Maps links — only use maps_url values from Results below.",
        "",
        "Results:",
    ]
    for i, p in enumerate(places, 1):
        name = p.get("name") or "Place"
        maps = (p.get("maps_url") or "").strip()
        if maps:
            bit = f"{i}. [{name}]({maps})"
        else:
            bit = f"{i}. {name}"
        if p.get("address"):
            bit += f" — {p['address']}"
        rating = p.get("rating")
        count = p.get("ratings_count")
        if rating is not None:
            bit += f" — ★ {rating}"
            if count is not None:
                bit += f" ({count} reviews)"
        if p.get("phone"):
            bit += f" — phone {p['phone']}"
        if maps:
            bit += f" — maps_url: {maps}"
        lines.append(bit)
    lines.append(
        "Pick the 3–6 that best match her request. Confirm hours/availability may change. "
        "This is directory help, not medical advice."
    )
    return "\n".join(lines)
