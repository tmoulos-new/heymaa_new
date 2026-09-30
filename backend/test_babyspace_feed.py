"""Tests for unofficial Babyspace listing → RSS / seed discovery."""
from __future__ import annotations

import unittest

from babyspace_feed import (
    parse_listing,
    parse_rss_links,
    safe_path,
    to_rss,
    FeedItem,
)

SAMPLE_LISTING = """
<html><body>
<div class='article-grid'>
<div itemscope itemtype='http://schema.org/Article'>
<div itemprop='mainEntityOfPage' itemscope itemtype='http://schema.org/WebPage'>
<link href='https://www.babyspace.gr/el/00-thilasmos-kai-paxisarkia' itemprop='url'>
</div>
<div class='article-summary' itemprop='articleSection'>
<span itemprop='description' style='display:none'>Summary about breastfeeding.</span>
<span itemprop='name' style='display:none'>Η σχέση του θηλασμού με την παιδική παχυσαρκία</span>
<div class='photo-wrap' itemprop='image'>
<a href="/el/00-thilasmos-kai-paxisarkia"><img alt="Η σχέση του θηλασμού με την παιδική παχυσαρκία" src="//cdn.example/a.jpg" /></a>
</div>
<time datetime='2026-09-29T11:54' itemprop='datePublished'>29-09-2026</time>
<p class='article-summary-title' itemprop='name headline'>
<a rel="bookmark" href="/el/00-thilasmos-kai-paxisarkia">Η σχέση του θηλασμού με την παιδική παχυσαρκία</a>
</p>
</div>
</div>
<div itemscope itemtype='http://schema.org/Article'>
<div itemprop='mainEntityOfPage' itemscope itemtype='http://schema.org/WebPage'>
<link href='https://www.babyspace.gr/el/family-road-trip' itemprop='url'>
</div>
<p class='article-summary-title' itemprop='name headline'>
<a rel="bookmark" href="/el/family-road-trip">Το πιο γλυκό οικογενειακό… road trip</a>
</p>
</div>
</div>
<a href="/el/tags/thilasmos">ΘΗΛΑΣΜΟΣ</a>
<a href="/el/tools">Εργαλεία</a>
</body></html>
"""


class BabyspaceFeedTests(unittest.TestCase):
    def test_safe_path_default_and_reject(self):
        self.assertEqual(safe_path(None), "/el/articles")
        self.assertEqual(safe_path("/el/tags/diatrofi"), "/el/tags/diatrofi")
        with self.assertRaises(ValueError):
            safe_path("/en/articles")
        with self.assertRaises(ValueError):
            safe_path("/el/../secret")

    def test_parse_listing_extracts_articles_not_tags(self):
        items = parse_listing(SAMPLE_LISTING)
        links = [it.link for it in items]
        self.assertIn("https://www.babyspace.gr/el/00-thilasmos-kai-paxisarkia", links)
        self.assertIn("https://www.babyspace.gr/el/family-road-trip", links)
        self.assertTrue(all("/tags/" not in u and "/tools" not in u for u in links))
        titles = {it.link: it.title for it in items}
        self.assertIn("θηλασμ", titles["https://www.babyspace.gr/el/00-thilasmos-kai-paxisarkia"].lower())

    def test_to_rss_and_parse_roundtrip_links(self):
        items = [
            FeedItem(
                title="Test article",
                link="https://www.babyspace.gr/el/test-article",
                description="Short blurb",
            )
        ]
        xml = to_rss(
            items,
            self_url="https://api.example/public/babyspace-rss",
            source_url="https://www.babyspace.gr/el/articles",
        )
        self.assertIn("<rss version=\"2.0\"", xml)
        self.assertIn("https://www.babyspace.gr/el/test-article", xml)
        links = parse_rss_links(xml)
        self.assertEqual(links, ["https://www.babyspace.gr/el/test-article"])

    def test_discover_filters_old_articles_when_since_years_set(self):
        from datetime import datetime, timezone, timedelta
        from unittest.mock import patch

        import babyspace_feed as bf

        now = datetime.now(timezone.utc)
        recent = FeedItem(
            title="Recent",
            link="https://www.babyspace.gr/el/recent-article",
            pub_date=now - timedelta(days=30),
        )
        old = FeedItem(
            title="Old",
            link="https://www.babyspace.gr/el/old-article",
            pub_date=now - timedelta(days=365 * 6),
        )
        with patch.object(bf, "fetch_listing_html", return_value="<html></html>"):
            with patch.object(bf, "parse_listing", return_value=[recent, old]):
                urls = bf.discover_babyspace_article_urls(
                    max_urls=50,
                    listing_paths=["/el/articles"],
                    since_years=5,
                )
        self.assertEqual(urls, ["https://www.babyspace.gr/el/recent-article"])


if __name__ == "__main__":
    unittest.main()
