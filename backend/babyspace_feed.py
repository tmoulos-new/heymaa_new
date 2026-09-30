"""
Unofficial Babyspace.gr article listing → RSS helper.

Babyspace does not publish an RSS feed. We scrape public /el listing pages
(article index, tags, categories) and expose the same data as RSS 2.0 from
our API. Seed discovery uses the parsed article URLs; full-page fetch still
creates RAG chunks (feed summaries alone are too thin).
"""
from __future__ import annotations

import html as html_lib
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import format_datetime
from typing import Optional
from urllib.parse import urljoin, urlparse, urlunparse, parse_qsl, urlencode

BABYSPACE_BASE = "https://www.babyspace.gr"
DEFAULT_LISTING_PATH = "/el/articles"
USER_AGENT = "Mozilla/5.0 (compatible; BabyspaceRSS/1.0; +https://heymaa.ai)"

_SKIP_PATH = re.compile(r"/(tags|banners|users|tools)\b|\d+-%CE|#", re.I)
_ARTICLE_SCOPE = re.compile(
    r'<[^>]+itemscope[^>]+itemtype=["\'][^"\']*(?:Article|BlogPosting)[^"\']*["\'][^>]*>',
    re.I,
)
_HREF_RE = re.compile(r"""href=["']([^"']+)["']""", re.I)
_IMG_SRC_RE = re.compile(r"""(?:src|data-src|content)=["']([^"']+)["']""", re.I)
_ITEMPROP_RE = re.compile(
    r"""itemprop=["']([^"']+)["'][^>]*(?:content=["']([^"']*)["']|href=["']([^"']+)["']|src=["']([^"']+)["'])?""",
    re.I,
)
_TITLE_LINK_RE = re.compile(
    r"""<(?:h[1-4]|[^>]*\btitle\b)[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)</a>""",
    re.I | re.S,
)
_DATE_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})\s*([+-]\d{2}):?(\d{2})"
)
_LINK_WITH_IMG_RE = re.compile(
    r"""<a[^>]+href=["']([^"']*?/el/[^"']+)["'][^>]*>\s*(?:<[^>]+>\s*)*<img\b([^>]*)>""",
    re.I | re.S,
)
_TAG_TEXT_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


@dataclass
class FeedItem:
    title: str
    link: str
    description: Optional[str] = None
    pub_date: Optional[datetime] = None
    author: Optional[str] = None
    image: Optional[str] = None
    categories: list[str] = field(default_factory=list)


def safe_path(path: Optional[str]) -> str:
    if not path:
        return DEFAULT_LISTING_PATH
    decoded = path
    try:
        from urllib.parse import unquote

        decoded = unquote(path)
    except Exception:
        pass
    if not decoded.startswith("/el") or ".." in decoded or "//" in decoded:
        raise ValueError("path must be a babyspace.gr page under /el")
    return path if path.startswith("/") else f"/{path}"


def _clean(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    out = _WS_RE.sub(" ", html_lib.unescape(s)).strip()
    return out or None


def _strip_tags(s: str) -> str:
    return _clean(_TAG_TEXT_RE.sub(" ", s)) or ""


def abs_url(href: Optional[str], *, base: str = BABYSPACE_BASE) -> Optional[str]:
    if not href:
        return None
    try:
        u = urlparse(urljoin(base, href.strip()))
        if u.scheme not in ("http", "https") or not u.netloc:
            return None
        # Drop site tracking/search param (matches TS feed helper)
        q = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True) if k.lower() != "query"]
        path = (u.path or "/").replace(" ", "").replace("%20", "")
        cleaned = urlunparse((u.scheme, u.netloc.lower(), path, "", urlencode(q), ""))
        return cleaned.rstrip("%20")
    except Exception:
        return None


def parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    raw = s.strip()
    m = _DATE_RE.match(raw)
    if m:
        try:
            return datetime.fromisoformat(f"{m.group(1)}T{m.group(2)}{m.group(3)}:{m.group(4)}")
        except ValueError:
            pass
    try:
        # dateutil-free fallback
        d = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return d
    except ValueError:
        return None


def _is_article_href(href: str) -> bool:
    path = urlparse(href).path or ""
    if not path.startswith("/el/"):
        return False
    if _SKIP_PATH.search(path):
        return False
    # Prefer deep article paths over the listing itself
    parts = [p for p in path.split("/") if p]
    if len(parts) < 2:
        return False
    if parts[-1] in ("articles", "el"):
        return False
    return True


def _itemprop_map(block: str) -> dict[str, str]:
    props: dict[str, str] = {}
    for m in _ITEMPROP_RE.finditer(block):
        name = (m.group(1) or "").strip().lower()
        val = m.group(2) or m.group(3) or m.group(4)
        if not val:
            # Try inner text of a short tag following itemprop
            continue
        cleaned = _clean(val)
        if cleaned and name not in props:
            props[name] = cleaned
    # headline / name often as link text
    for m in _TITLE_LINK_RE.finditer(block):
        if "headline" not in props:
            t = _strip_tags(m.group(2))
            if t:
                props["headline"] = t
        if "url" not in props:
            link = abs_url(m.group(1))
            if link:
                props["url"] = link
    return props


def _split_itemscope_blocks(html: str) -> list[str]:
    """Rough split of Article/BlogPosting itemscope regions."""
    starts = [m.start() for m in _ARTICLE_SCOPE.finditer(html)]
    if not starts:
        return []
    blocks: list[str] = []
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else min(len(html), start + 6000)
        blocks.append(html[start:end])
    return blocks


def parse_listing(html: str) -> list[FeedItem]:
    items: dict[str, FeedItem] = {}

    def add(it: FeedItem) -> None:
        if not it.title or not it.link:
            return
        if not _is_article_href(it.link):
            return
        key = it.link.split("?")[0]
        if key not in items:
            items[key] = it

    # Strategy 1: schema.org Article / BlogPosting microdata
    for block in _split_itemscope_blocks(html):
        props = _itemprop_map(block)
        title_link = None
        tl = _TITLE_LINK_RE.search(block)
        if tl:
            title_link = abs_url(tl.group(1))
        link = (
            abs_url(props.get("url") or props.get("mainentityofpage"))
            or title_link
        )
        if not link:
            for hm in _HREF_RE.finditer(block):
                cand = abs_url(hm.group(1))
                if cand and _is_article_href(cand) and "/tags/" not in cand:
                    link = cand
                    break
        image = abs_url(props.get("image"))
        if not image:
            im = _IMG_SRC_RE.search(block)
            if im:
                image = abs_url(im.group(1))
        title = props.get("headline") or props.get("name")
        if not title and tl:
            title = _strip_tags(tl.group(2))
        pub = parse_date(props.get("datepublished"))
        if not pub:
            tm = re.search(
                r"""<time[^>]+(?:itemprop=["']datePublished["'][^>]+datetime=["']([^"']+)["']|datetime=["']([^"']+)["'][^>]+itemprop=["']datePublished["'])""",
                block,
                re.I,
            )
            if tm:
                pub = parse_date(tm.group(1) or tm.group(2))
        cats: list[str] = []
        add(
            FeedItem(
                title=title or "",
                link=link or "",
                description=props.get("description"),
                pub_date=pub,
                author=props.get("author"),
                image=image,
                categories=cats,
            )
        )

    # Strategy 2: article links that wrap a thumbnail
    if not items:
        for m in _LINK_WITH_IMG_RE.finditer(html):
            href = m.group(1) or ""
            if _SKIP_PATH.search(href):
                continue
            link = abs_url(href)
            if not link or not _is_article_href(link):
                continue
            img_attrs = m.group(2) or ""
            title = None
            tm = re.search(r"""(?:title|alt)=["']([^"']+)["']""", img_attrs, re.I)
            if tm:
                title = _clean(tm.group(1))
            if not title or len(title) < 12:
                continue
            image = None
            sm = re.search(r"""src=["']([^"']+)["']""", img_attrs, re.I)
            if sm:
                image = abs_url(sm.group(1))
            add(FeedItem(title=title, link=link, image=image))

    # Strategy 3: any deep /el/ article hrefs with readable anchor text
    if len(items) < 3:
        for m in re.finditer(
            r"""<a[^>]+href=["']([^"']+/el/[^"']+)["'][^>]*>(.*?)</a>""",
            html,
            re.I | re.S,
        ):
            href = m.group(1) or ""
            if _SKIP_PATH.search(href):
                continue
            link = abs_url(href)
            if not link or not _is_article_href(link):
                continue
            title = _strip_tags(m.group(2))
            if not title or len(title) < 12:
                continue
            add(FeedItem(title=title, link=link))

    ordered = sorted(
        items.values(),
        key=lambda it: it.pub_date.timestamp() if it.pub_date else 0,
        reverse=True,
    )
    return ordered


def _esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def to_rss(
    items: list[FeedItem],
    *,
    self_url: str,
    source_url: str,
    title: str = "Babyspace.gr — Νέα Άρθρα",
) -> str:
    parts: list[str] = []
    for it in items:
        desc_bits = []
        if it.image:
            desc_bits.append(f'<p><img src="{_esc(it.image)}" alt="" /></p>')
        if it.description:
            desc_bits.append(f"<p>{_esc(it.description)}</p>")
        desc = "".join(desc_bits)
        # Escape CDATA terminators
        desc = desc.replace("]]>", "]]]]><![CDATA[>")
        lines = [
            "    <item>",
            f"      <title>{_esc(it.title)}</title>",
            f"      <link>{_esc(it.link)}</link>",
            f'      <guid isPermaLink="true">{_esc(it.link)}</guid>',
        ]
        if it.pub_date:
            dt = it.pub_date if it.pub_date.tzinfo else it.pub_date.replace(tzinfo=timezone.utc)
            lines.append(f"      <pubDate>{format_datetime(dt)}</pubDate>")
        if it.author:
            lines.append(f"      <dc:creator>{_esc(it.author)}</dc:creator>")
        for cat in it.categories:
            lines.append(f"      <category>{_esc(cat)}</category>")
        if it.image:
            img_type = "png" if it.image.lower().endswith(".png") else "jpeg"
            lines.append(
                f'      <enclosure url="{_esc(it.image)}" type="image/{img_type}" length="0" />'
            )
        lines.append(f"      <description><![CDATA[{desc}]]></description>")
        lines.append("    </item>")
        parts.append("\n".join(lines))

    body = "\n".join(parts)
    now = format_datetime(datetime.now(timezone.utc))
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>{_esc(title)}</title>
    <link>{_esc(source_url)}</link>
    <atom:link href="{_esc(self_url)}" rel="self" type="application/rss+xml" />
    <description>Unofficial feed generated from babyspace.gr by HeyMaa</description>
    <language>el</language>
    <lastBuildDate>{now}</lastBuildDate>
{body}
  </channel>
</rss>
"""


def _listing_url(path_or_url: str) -> str:
    raw = (path_or_url or "").strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return BABYSPACE_BASE + safe_path(raw)


def fetch_listing_html(path_or_url: str = DEFAULT_LISTING_PATH, *, timeout: int = 25) -> str:
    import requests

    url = _listing_url(path_or_url)
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "el",
        "Accept": "text/html,application/xhtml+xml",
    }
    try:
        res = requests.get(url, headers=headers, timeout=timeout)
    except requests.exceptions.SSLError:
        # Some local Python installs lack CA certs; Babyspace still serves HTTPS.
        res = requests.get(url, headers=headers, timeout=timeout, verify=False)
    res.raise_for_status()
    if not res.encoding or res.encoding.lower() in ("iso-8859-1", "ascii"):
        res.encoding = res.apparent_encoding or "utf-8"
    return res.text


def build_feed(
    path: str = DEFAULT_LISTING_PATH,
    *,
    self_url: str,
    limit: int = 30,
) -> tuple[str, int, list[FeedItem]]:
    path = safe_path(path)
    source_url = BABYSPACE_BASE + path
    html = fetch_listing_html(path)
    items = parse_listing(html)[: max(1, min(int(limit), 100))]
    xml = to_rss(items, self_url=self_url, source_url=source_url)
    return xml, len(items), items


def discover_babyspace_article_urls(
    *,
    max_urls: int = 200,
    listing_paths: Optional[list[str]] = None,
    since_years: Optional[float] = 5.0,
    per_page: int = 30,
    max_pages: int = 250,
) -> list[str]:
    """
    Discover Babyspace article URLs, newest first.

    By default walks /el/articles pagination until:
    - max_urls is reached, or
    - articles fall outside since_years (when dates are present), or
    - max_pages is reached.

    If listing_paths is provided, only those pages are scraped (legacy/manual).
    """
    cutoff: Optional[datetime] = None
    if since_years is not None and float(since_years) > 0:
        from datetime import timedelta

        cutoff = datetime.now(timezone.utc) - timedelta(days=int(365.25 * float(since_years)))

    def _aware(dt: Optional[datetime]) -> Optional[datetime]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    def _too_old(it: FeedItem) -> bool:
        if cutoff is None:
            return False
        pub = _aware(it.pub_date)
        if pub is None:
            return False
        return pub < cutoff

    seen: set[str] = set()
    out: list[str] = []

    def _consume(items: list[FeedItem]) -> tuple[int, int]:
        """Returns (added, old_with_date)."""
        added = 0
        old = 0
        for it in items:
            if _too_old(it):
                old += 1
                continue
            key = it.link.split("?")[0]
            if key in seen:
                continue
            seen.add(key)
            out.append(it.link)
            added += 1
            if len(out) >= max_urls:
                break
        return added, old

    # Manual listing paths (tests / tag pages)
    if listing_paths:
        for path in listing_paths:
            if len(out) >= max_urls:
                break
            try:
                html = fetch_listing_html(path)
            except Exception:
                continue
            _consume(parse_listing(html))
        return out[:max_urls]

    # Auto-paginate newest → older
    per = max(10, min(int(per_page or 30), 50))
    pages = max(1, min(int(max_pages or 250), 400))
    stale_pages = 0
    for page in range(1, pages + 1):
        if len(out) >= max_urls:
            break
        path = (
            DEFAULT_LISTING_PATH
            if page == 1
            else f"{DEFAULT_LISTING_PATH}?page={page}&per={per}"
        )
        try:
            html = fetch_listing_html(path)
        except Exception:
            break
        items = parse_listing(html)
        if not items:
            break
        before = len(out)
        _added, old = _consume(items)
        # Listing is newest-first: stop after a couple of fully-old pages
        dated = sum(1 for it in items if it.pub_date is not None)
        if cutoff is not None and dated > 0 and old >= dated and _added == 0 and len(out) == before:
            stale_pages += 1
            if stale_pages >= 2:
                break
        else:
            stale_pages = 0
        # No progress and page looked empty of new links
        if _added == 0 and old == 0 and len(items) < 3:
            break
    return out[:max_urls]


def parse_rss_links(xml_text: str) -> list[str]:
    """Extract <item><link> URLs from an RSS/Atom-ish feed."""
    links: list[str] = []
    # Prefer item blocks
    for block in re.findall(r"<item\b[^>]*>(.*?)</item>", xml_text, flags=re.I | re.S):
        m = re.search(r"<link[^>]*>(.*?)</link>", block, flags=re.I | re.S)
        if m:
            links.append(html_lib.unescape(_strip_tags(m.group(1))))
            continue
        m = re.search(r'''<link[^>]+href=["']([^"']+)["']''', block, flags=re.I)
        if m:
            links.append(html_lib.unescape(m.group(1).strip()))
            continue
        gm = re.search(r"<guid[^>]*>(.*?)</guid>", block, flags=re.I | re.S)
        if gm:
            g = html_lib.unescape(_strip_tags(gm.group(1)))
            if g.startswith("http"):
                links.append(g)
    if links:
        return links
    # Fallback: any <link>http...
    for m in re.finditer(r"<link[^>]*>(https?://[^<]+)</link>", xml_text, flags=re.I):
        links.append(html_lib.unescape(m.group(1).strip()))
    return links
