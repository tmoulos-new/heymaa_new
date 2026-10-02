"""Topic filters for knowledge-source URL discovery (baby/childhood)."""
from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

# Shared keep: pregnancy / newborn / infant / child / school-age vaccines & related
BABY_CHILDHOOD_INCLUDE_RE = re.compile(
    r"παιδ|βρέφ|νεογν|μωρ|εμβολ|κυήσ|εγκυμ|θηλασ|ανεμευλογ|ιλαρ|κοκκύτ|κοκκυτ|"
    r"παρωτίτ|ερυθρ|ροτα[ιϊ]|μηνιγγιτ|πολιομυελ|διφθερ|τεταν|αιμοφιλ|"
    r"πνευμονι[όο]κ|hpv|περτουσ|pertussis|measles|mumps|rubella|varicella|"
    r"infant|child|neonat|pregnan|breastfeed|vaccine|εμβολιασ|σχολικ|νηπιαγ|"
    r"παιδιατρ|συγγεν|τοκετ|λοχεί|λοχει|προωρ|whooping|chickenpox|rotavirus|"
    r"diphtheria|tetanus|polio|hib|pneumococ|meningococ|hepatitis.?b|"
    r"ηπατίτιδ.?[ab]|ηπατιτιδ.?[ab]|rsv|αναπνευστικ.?συγκυτιακ|"
    r"συγκυτιακ.?ιό|συγκυτιακ.?ιο|"
    r"βρεφονηπ|σχολικ.?μον|οστρακ|παρβοϊ|parvovir|λιστερ|"
    r"τοξοπλάσμ|τοξοπλασμ|σύφιλη|συφιλη|κοξάκι|coxsack|"
    r"anemevlog|ilara|kokkyt|parotit|erythr|rota[iïy]|miniggit|meningit|"
    r"poliomyel|difther|tetan|emvoliasm|syggen|brefonipiak|ostrok|"
    r"νεογνικ.?τέταν|συγγενή.?ερυθρ|συγγενή.?σύφιλ|συγγενή.?τοξο|"
    r"μητρότ|μητροτ|μαιευτ|κυλικε|διατροφ.?παιδ|diatrofh.?paid|"
    r"nirsevimab|pcv20|brefwn|paidiwn|efhbwn|paidioy|efhboy|"
    r"antigripikos.?emboliasmos|epoxikh.?griph",
    re.I,
)

BABY_CHILDHOOD_EXCLUDE_RE = re.compile(
    r"prokirykseis|prokhryk|organismos|organogram|diktyo-ergastirion|"
    r"promitheion|promhthe|prosopikoy|proslhps|diorism|"
    r"διαγωνισ|προκήρυξ|προκηρυξ|cookie|privacy|gdpr|wp-content|"
    r"kapnisma-atmisma|αλκοόλ|αλκοολ|ναρκωτικ|alkool|"
    r"times-farmakwn|deltia-timwn|ajax/redirect|accessibility|"
    r"tameioy-anakampshs|strathgikh-kata-ths-apaths|"
    r"\.(?:jpg|jpeg|png|gif|webp|svg|zip|css|js)(?:$|\?)",
    re.I,
)

# Back-compat aliases used by EODY sync script
EODY_BABY_CHILDHOOD_INCLUDE_RE = BABY_CHILDHOOD_INCLUDE_RE
EODY_BABY_CHILDHOOD_EXCLUDE_RE = BABY_CHILDHOOD_EXCLUDE_RE

_HOST_BY_KEY = {
    "eody-gov-gr": "eody.gov.gr",
    "moh-gov-gr": "moh.gov.gr",
}


def is_baby_childhood_url(
    url: str,
    *,
    title: str = "",
    snippet: str = "",
    host: Optional[str] = None,
) -> bool:
    """Return True if a URL looks related to babies / childhood / vaccines."""
    u = (url or "").strip()
    if not u:
        return False
    if host and host.lower() not in u.lower():
        return False
    if BABY_CHILDHOOD_EXCLUDE_RE.search(u):
        return False
    blob = f"{title} {snippet} {u}"
    return bool(BABY_CHILDHOOD_INCLUDE_RE.search(blob))


def is_eody_baby_childhood_url(url: str, *, title: str = "", snippet: str = "") -> bool:
    return is_baby_childhood_url(
        url, title=title, snippet=snippet, host="eody.gov.gr"
    )


def is_moh_baby_childhood_url(url: str, *, title: str = "", snippet: str = "") -> bool:
    return is_baby_childhood_url(
        url, title=title, snippet=snippet, host="moh.gov.gr"
    )


def filter_urls_by_topic(
    urls: list[str],
    *,
    source_key: str,
    topic_filter: Optional[str] = None,
    include_regex: Optional[str] = None,
    exclude_regex: Optional[str] = None,
) -> list[str]:
    """Filter discovered URLs using knowledge_sources topic metadata."""
    key = (source_key or "").strip().lower()
    topic = (topic_filter or "").strip().lower()
    default_topic_keys = {"eody-gov-gr", "moh-gov-gr"}
    if not topic and key not in default_topic_keys:
        return urls

    if key in default_topic_keys and not topic:
        topic = "baby_childhood"

    if topic not in ("baby_childhood", "baby", "childhood", "paidi", "brefos"):
        return urls

    include = (
        re.compile(include_regex, re.I)
        if include_regex
        else BABY_CHILDHOOD_INCLUDE_RE
    )
    exclude = (
        re.compile(exclude_regex, re.I)
        if exclude_regex
        else BABY_CHILDHOOD_EXCLUDE_RE
    )
    required_host = _HOST_BY_KEY.get(key)

    out: list[str] = []
    seen: set[str] = set()
    for raw in urls:
        u = (raw or "").strip()
        if not u or u in seen:
            continue
        if exclude.search(u):
            continue
        if required_host and required_host not in u.lower():
            continue
        path = urlparse(u).path.rstrip("/").lower()
        if path in ("", "/", "/el", "/en"):
            continue
        # Drop pure listing pagination hubs
        if "?start=" in u and not re.search(r"/\d{3,}-", path):
            continue
        if include.search(u):
            seen.add(u)
            out.append(u)
    return out
