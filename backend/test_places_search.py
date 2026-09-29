"""Unit tests for places_search helpers (no live API calls)."""
import unittest

from places_search import build_places_search_query, format_places_for_prompt


class QueryTests(unittest.TestCase):
    def test_strips_greeting_and_keeps_request(self):
        q = build_places_search_query(
            "καλησπέρα μπορείς να μου βρεις παιδίατρους στη ηλιουπολή?"
        )
        self.assertIn("παιδίατρους", q)
        self.assertIn("ηλιουπολή", q.casefold())
        self.assertNotIn("καλησπέρα", q.casefold())

    def test_appends_location_hint(self):
        q = build_places_search_query("βρες μου παιδίατρο", location_hint="Athens, GR")
        self.assertIn("Athens", q)


class FormatTests(unittest.TestCase):
    def test_format(self):
        text = format_places_for_prompt(
            [{"name": "Dr Test", "address": "Ilioupoli", "rating": 4.8, "ratings_count": 12, "maps_url": "https://maps.example", "phone": ""}]
        )
        self.assertIn("Dr Test", text)
        self.assertIn("Place search results", text)


if __name__ == "__main__":
    unittest.main()
