"""Unit tests for places_search helpers (no live API calls)."""
import unittest

from places_search import build_places_search_query, format_places_for_prompt, places_for_client


class QueryTests(unittest.TestCase):
    def test_strips_greeting_and_keeps_request(self):
        q = build_places_search_query(
            "καλησπέρα μπορείς να μου βρεις παιδίατρους στη ηλιουπολή?"
        )
        self.assertIn("παιδίατρους", q)
        # Normalizes common Ηλιούπολη spellings
        self.assertTrue("ηλιούπολ" in q.casefold() or "ηλιουπολ" in q.casefold())
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
        self.assertIn("[Dr Test](https://maps.example)", text)
        self.assertIn("markdown", text.casefold())

    def test_places_for_client(self):
        out = places_for_client(
            [
                {
                    "name": "Clinic A",
                    "address": "Athens",
                    "rating": 4.5,
                    "maps_url": "https://maps.example/a",
                    "lat": 37.97,
                    "lng": 23.72,
                }
            ]
        )
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["name"], "Clinic A")
        self.assertEqual(out[0]["lat"], 37.97)

    def test_stable_maps_url_prefers_lat_lng(self):
        from places_search import stable_maps_url

        url = stable_maps_url(
            name="Ploes Venue",
            address="Παλαιό Φάληρο",
            lat=37.9351243,
            lng=23.6885092,
            fallback="https://maps.google.com/?cid=123&g_mp=abc",
        )
        self.assertIn("api=1", url)
        self.assertIn("37.9351243", url)
        self.assertNotIn("cid=", url)

    def test_rewrite_replaces_cid_link(self):
        from places_search import rewrite_reply_place_links

        places = [
            {
                "name": "Ploes Venue",
                "maps_url": "https://www.google.com/maps/search/?api=1&query=37.9%2C23.7",
            }
        ]
        reply = "- **[Ploes Venue](https://maps.google.com/?cid=1&g_mp=x)** — Παλαιό Φάληρο"
        out = rewrite_reply_place_links(reply, places)
        self.assertIn("api=1", out)
        self.assertNotIn("cid=", out)

    def test_query_fixes_paleo_faliro_typo(self):
        q = build_places_search_query("Θέλω λίστα χώρων πάρτυ στο παλαίο φάληρο")
        self.assertIn("Παλαιό Φάληρο", q)


if __name__ == "__main__":
    unittest.main()
