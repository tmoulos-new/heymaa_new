"""URL / website acquisition for RAG (HTML → canonical text)."""
from __future__ import annotations

import hashlib
import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from typing import Iterable, Optional
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import requests

USER_AGENT = "HeyMaaKnowledgeBot/1.0 (+https://heymaa.ai)"
DEFAULT_TIMEOUT = 25
TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
}


class _HTMLTextExtractor(HTMLParser):
    SKIP_TAGS = {
        "script",
        "style",
        "noscript",
        "svg",
        "nav",
        "footer",
        "header",
        "aside",
        "form",
        "iframe",
    }

    def __init__(self) -> None:
        super().__init__()
        self._skip_depth = 0
        self._chunks: list[str] = []
        self.title: str = ""
        self._in_title = False
        self.links: list[str] = []
        self.canonical: Optional[str] = None
        self.lang: Optional[str] = None

    def handle_starttag(self, tag: str, attrs) -> None:
        attrs_d = {k.lower(): (v or "") for k, v in attrs}
        t = tag.lower()
        if t == "html" and attrs_d.get("lang"):
            self.lang = attrs_d["lang"].split("-")[0].lower()
        if t == "title":
            self._in_title = True
        if t == "a" and attrs_d.get("href"):
            self.links.append(attrs_d["href"])
        if t == "link" and attrs_d.get("rel", "").lower() == "canonical" and attrs_d.get("href"):
            self.canonical = attrs_d["href"]
        if t in self.SKIP_TAGS:
            self._skip_depth += 1
            return
        if t in {"p", "br", "li", "h1", "h2", "h3", "h4", "tr", "div", "section", "article"}:
            self._chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == "title":
            self._in_title = False
        if t in self.SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        text = data.strip()
        if not text:
            return
        if self._in_title:
            self.title = (self.title + " " + text).strip()
            return
        self._chunks.append(text + " ")

    def text(self) -> str:
        raw = "".join(self._chunks)
        raw = re.sub(r"[ \t]+", " ", raw)
        raw = re.sub(r"\n{3,}", "\n\n", raw)
        return raw.strip()


def normalize_url(url: str, *, keep_query: bool = False) -> str:
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError(f"Invalid URL: {url}")
    host = parsed.netloc.lower()
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    query = ""
    if keep_query and parsed.query:
        pairs = [
            (k, v)
            for k, v in parse_qsl(parsed.query, keep_blank_values=True)
            if k.lower() not in TRACKING_PARAMS
        ]
        query = urlencode(pairs, doseq=True)
    return urlunparse((parsed.scheme.lower(), host, path, "", query, ""))


def url_hash(url: str) -> str:
    return hashlib.sha256(normalize_url(url).encode("utf-8")).hexdigest()


def fetch_url(url: str, *, timeout: int = DEFAULT_TIMEOUT) -> tuple[str, str, dict]:
    """Returns (final_url, content_type, response_text)."""
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
    res = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
    res.raise_for_status()
    ctype = (res.headers.get("content-type") or "").split(";")[0].strip().lower()
    # requests may guess encoding poorly for Greek sites
    if not res.encoding or res.encoding.lower() in ("iso-8859-1", "ascii"):
        res.encoding = res.apparent_encoding or "utf-8"
    return res.url, ctype, res.text


def extract_html_document(html: str, base_url: str) -> dict:
    parser = _HTMLTextExtractor()
    try:
        parser.feed(html)
        parser.close()
    except Exception:
        pass
    title = parser.title or ""
    content = parser.text()
    # Drop very short / junk extractions
    if len(content.split()) < 40:
        # fallback: strip tags roughly
        content = re.sub(r"<[^>]+>", " ", html)
        content = re.sub(r"\s+", " ", content).strip()
    canonical = parser.canonical
    if canonical:
        try:
            canonical = normalize_url(urljoin(base_url, canonical))
        except ValueError:
            canonical = None
    abs_links: list[str] = []
    for href in parser.links:
        try:
            abs_links.append(normalize_url(urljoin(base_url, href)))
        except ValueError:
            continue
    return {
        "title": title[:300],
        "content": content,
        "language": parser.lang,
        "canonical_url": canonical,
        "links": abs_links,
        "provenance": {
            "source_type": "url",
            "original_location": base_url,
            "content_hash": hashlib.sha256(content.encode("utf-8", errors="ignore")).hexdigest(),
        },
    }


def acquire_url(url: str) -> dict:
    """Fetch + extract a single URL into a canonical content object."""
    normalized = normalize_url(url)
    final_url, ctype, body = fetch_url(normalized)
    if "html" not in ctype and "xml" not in ctype and not body.lstrip().startswith("<"):
        raise ValueError(f"Unsupported content-type for URL ingest: {ctype or 'unknown'}")
    doc = extract_html_document(body, final_url)
    source_url = doc.get("canonical_url") or normalize_url(final_url)
    title = doc["title"] or source_url
    content = doc["content"]
    if len(content.split()) < 40:
        raise ValueError("Extracted page text is too short to ingest.")
    return {
        "source_type": "url",
        "source_reference": source_url,
        "original_location": normalized,
        "title": title,
        "language": doc.get("language") or "el",
        "content": content,
        "metadata": {
            "content_type": ctype,
            "url_hash": url_hash(source_url),
            "word_count": len(content.split()),
        },
        "provenance": doc.get("provenance") or {},
        "links": doc.get("links") or [],
    }


def parse_sitemap_locs(xml_text: str) -> list[str]:
    locs: list[str] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        # fallback regex
        return re.findall(r"<loc>\s*([^<]+)\s*</loc>", xml_text, flags=re.I)
    # handle namespaces
    for el in root.iter():
        if el.tag.endswith("loc") and el.text:
            locs.append(el.text.strip())
    return locs


def discover_sitemap_urls(sitemap_url: str, *, max_urls: int = 80) -> list[str]:
    _, ctype, body = fetch_url(sitemap_url)
    locs = parse_sitemap_locs(body)
    out: list[str] = []
    for loc in locs:
        if loc.endswith(".xml") and "sitemap" in loc.lower():
            try:
                nested = discover_sitemap_urls(loc, max_urls=max_urls - len(out))
                out.extend(nested)
            except Exception:
                continue
        else:
            try:
                out.append(normalize_url(loc))
            except ValueError:
                continue
        if len(out) >= max_urls:
            break
    # de-dupe preserve order
    seen = set()
    unique = []
    for u in out:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    return unique[:max_urls]


def discover_site_links(seed_url: str, *, same_host: bool = True, max_urls: int = 40) -> list[str]:
    seed = normalize_url(seed_url)
    host = urlparse(seed).netloc
    try:
        doc = acquire_url(seed)
        links = [seed] + list(doc.get("links") or [])
    except Exception:
        _, _, html = fetch_url(seed)
        extracted = extract_html_document(html, seed)
        links = [seed] + list(extracted.get("links") or [])

    out: list[str] = []
    seen = set()
    skip_ext = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".pdf", ".zip", ".css", ".js")
    for link in links:
        try:
            u = normalize_url(link)
        except ValueError:
            continue
        if same_host and urlparse(u).netloc != host:
            continue
        path = urlparse(u).path.lower()
        if path.endswith(skip_ext):
            continue
        if any(x in path for x in ("/cart", "/checkout", "/account", "/login", "/wp-admin", "/tag/", "/author/")):
            continue
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
        if len(out) >= max_urls:
            break
    return out


def discover_source_urls(
    *,
    base_url: str,
    sitemap_url: Optional[str] = None,
    max_urls: int = 40,
) -> list[str]:
    urls: list[str] = []
    if sitemap_url:
        try:
            urls = discover_sitemap_urls(sitemap_url, max_urls=max(max_urls * 3, 80))
        except Exception:
            urls = []
    if len(urls) < 5:
        crawled = discover_site_links(base_url, max_urls=max(max_urls * 2, 40))
        for u in crawled:
            if u not in urls:
                urls.append(u)

    skip_ext = (
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".svg",
        ".pdf",
        ".zip",
        ".css",
        ".js",
        ".mp4",
        ".mp3",
    )

    def usable(u: str) -> bool:
        p = urlparse(u)
        path = (p.path or "").lower()
        if path.endswith(skip_ext):
            return False
        if "/files/" in path or "/wp-content/uploads/" in path:
            return False
        if any(x in path for x in ("/cart", "/checkout", "/account", "/login", "/wp-admin", "/tag/", "/author/")):
            return False
        return True

    # Prefer article-like paths for parenting blogs
    def score(u: str) -> int:
        p = urlparse(u).path.lower()
        s = 0
        for token in (
            "blog",
            "article",
            "tips",
            "guide",
            "pregnancy",
            "baby",
            "parent",
            "toket",
            "egky",
            "egym",
            "θέμα",
            "arthra",
        ):
            if token in p or token in u.lower():
                s += 2
        if p.count("/") >= 2:
            s += 1
        if p in ("/", ""):
            s -= 3
        if path_looks_like_media(p):
            s -= 10
        return s

    cleaned = [u for u in urls if usable(u)]
    cleaned = sorted(set(cleaned), key=score, reverse=True)
    return cleaned[:max_urls]


def path_looks_like_media(path: str) -> bool:
    return any(path.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".mp4"))


SEED_SOURCES = [
    {
        "source_key": "babyspace",
        "name": "Babyspace",
        "base_url": "https://www.babyspace.gr/",
        "sitemap_url": None,
        "language": "el",
        "max_urls": 25,
    },
    {
        "source_key": "myparenthood",
        "name": "My Parenthood",
        "base_url": "https://myparenthood.gr/blog/",
        "sitemap_url": "https://myparenthood.gr/post-sitemap.xml",
        "language": "el",
        "max_urls": 40,
    },
]


def iter_seed_page_plans(max_per_source: Optional[int] = None) -> Iterable[dict]:
    for src in SEED_SOURCES:
        limit = max_per_source if max_per_source is not None else int(src["max_urls"])
        urls = discover_source_urls(
            base_url=src["base_url"],
            sitemap_url=src.get("sitemap_url"),
            max_urls=limit,
        )
        for u in urls:
            yield {
                "source_key": src["source_key"],
                "name": src["name"],
                "language": src["language"],
                "url": u,
            }
