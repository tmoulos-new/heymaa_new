"""Unit tests for article published_at extraction."""
import unittest
from datetime import timezone

from url_acquire import extract_published_at, parse_published_date


class ParsePublishedDateTests(unittest.TestCase):
    def test_iso_date(self):
        dt = parse_published_date("2024-05-01")
        self.assertIsNotNone(dt)
        assert dt is not None
        self.assertEqual(dt.year, 2024)
        self.assertEqual(dt.tzinfo, timezone.utc)

    def test_iso_datetime_z(self):
        dt = parse_published_date("2024-05-01T12:30:00Z")
        self.assertIsNotNone(dt)
        assert dt is not None
        self.assertEqual(dt.hour, 12)


class ExtractPublishedAtTests(unittest.TestCase):
    def test_json_ld(self):
        html = """
        <html><head>
        <script type="application/ld+json">
        {"@type":"Article","datePublished":"2023-11-15T08:00:00+02:00","headline":"X"}
        </script>
        </head><body></body></html>
        """
        dt = extract_published_at(html)
        self.assertIsNotNone(dt)
        assert dt is not None
        self.assertEqual(dt.year, 2023)
        self.assertEqual(dt.month, 11)

    def test_meta_article_published_time(self):
        html = '<meta property="article:published_time" content="2022-01-09T10:00:00Z" />'
        dt = extract_published_at(html)
        self.assertIsNotNone(dt)
        assert dt is not None
        self.assertEqual(dt.year, 2022)

    def test_time_itemprop(self):
        html = '<time itemprop="datePublished" datetime="2021-07-04"></time>'
        dt = extract_published_at(html)
        self.assertIsNotNone(dt)
        assert dt is not None
        self.assertEqual(dt.day, 4)


if __name__ == "__main__":
    unittest.main()
