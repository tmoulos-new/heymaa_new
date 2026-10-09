"""Topic filters for knowledge-source URL discovery (baby/childhood)."""
from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

# Shared keep: pregnancy / newborn / infant / child / school-age vaccines & related
# Includes Greek (EODY/MOH), English, and Romanian (INSP) terms.
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
    r"antigripikos.?emboliasmos|epoxikh.?griph|"
    # Romanian (INSP) — children, pregnancy, vaccines, nutrition
    r"copil|copii|copilul|vaccin|vaccinare|imuniz|sarcin[aă]|gravid|"
    r"al[aă]pt|nou-?n[aă]sc|prematur|rujeol|rubeol|oreion|pneumococ|"
    r"hepatit|poliomiel|difter|tetanos|tuse.?convuls|prenatal|pediatr|"
    r"nutri[tț]ie.?infantil|adolescent|calendar.?na[tț]ional.?de.?vaccin|"
    r"program.?na[tț]ional.?de.?vaccin|BCG|DTPa|ROR|Haemophilus|"
    r"recomandari.?pentru.?o.?sarcina|consulta[tț]i[ae].?preventiv.?integrat.?la.?copil|"
    # WHO English hubs
    r"newborn|preterm|complementary.?feeding|young.?child.?feeding|"
    r"immunization.?coverage|immunization.?routine|kangaroo.?mother|"
    r"maternal.?newborn|child.?health|adolescent.?health|"
    r"congenital.?rubella|birth.?defect|low.?birth.?weight",
    re.I,
)

BABY_CHILDHOOD_EXCLUDE_RE = re.compile(
    r"prokirykseis|prokhryk|organismos|organogram|diktyo-ergastirion|"
    r"promitheion|promhthe|prosopikoy|proslhps|diorism|"
    r"διαγωνισ|προκήρυξ|προκηρυξ|cookie|privacy|gdpr|"
    # Allow topical PDFs under wp-content/uploads; drop image/media assets only.
    r"wp-content/uploads/.*\.(?:jpg|jpeg|png|gif|webp|svg|zip)(?:$|\?)|"
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
    "insp-gov-ro": "insp.gov.ro",
    "who-int": "who.int",
    "ms-gov-ro": "ms.ro",
    "babyspace-ro": "babyspace.com.ro",
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


def is_insp_baby_childhood_url(url: str, *, title: str = "", snippet: str = "") -> bool:
    return is_baby_childhood_url(
        url, title=title, snippet=snippet, host="insp.gov.ro"
    )


def is_who_baby_childhood_url(url: str, *, title: str = "", snippet: str = "") -> bool:
    return is_baby_childhood_url(
        url, title=title, snippet=snippet, host="who.int"
    )


def is_ms_baby_childhood_url(url: str, *, title: str = "", snippet: str = "") -> bool:
    return is_baby_childhood_url(
        url, title=title, snippet=snippet, host="ms.ro"
    )


def is_babyspace_ro_url(url: str, *, title: str = "", snippet: str = "") -> bool:
    """Babyspace RO is parenting-focused; keep most article URLs under /ro/."""
    u = (url or "").strip()
    if "babyspace.com.ro" not in u.lower():
        return False
    if BABY_CHILDHOOD_EXCLUDE_RE.search(u):
        return False
    path = urlparse(u).path.lower()
    if any(x in path for x in ("/e-shop", "/conecteaza", "/inscrie", "/termeni", "/cookie")):
        return False
    # Whole site is childhood/parenting — keep articles and guides.
    if "/ro/" in path or path.rstrip("/").endswith("/ro"):
        return True
    return is_baby_childhood_url(u, title=title, snippet=snippet, host="babyspace.com.ro")


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
    default_topic_keys = {
        "eody-gov-gr",
        "moh-gov-gr",
        "insp-gov-ro",
        "who-int",
        "ms-gov-ro",
        "babyspace-ro",
    }
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
        if path in ("", "/", "/el", "/en", "/ro"):
            continue
        # Drop pure listing pagination hubs
        if "?start=" in u and not re.search(r"/\d{3,}-", path):
            continue
        keep = bool(include.search(u))
        if key == "babyspace-ro" and not keep:
            keep = is_babyspace_ro_url(u)
        if keep:
            seen.add(u)
            out.append(u)
    return out
