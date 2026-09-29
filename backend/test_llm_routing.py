import unittest

from llm_routing import (
    DEFAULT_LLM_ROUTING,
    is_complex_message,
    is_places_message,
    normalize_llm_routing,
    resolve_provider_order,
)


class NormalizeTests(unittest.TestCase):
    def test_defaults(self):
        out = normalize_llm_routing(None)
        self.assertEqual(out["default_order"], DEFAULT_LLM_ROUTING["default_order"])
        self.assertEqual(out["places_order"][0], "gemini")
        self.assertTrue(out["places_keywords"])

    def test_dedupe_and_fill(self):
        out = normalize_llm_routing({"default_order": ["gemini", "gemini", "nope"]})
        self.assertEqual(out["default_order"][0], "gemini")
        self.assertIn("grok", out["default_order"])
        self.assertIn("claude", out["default_order"])


class ResolveTests(unittest.TestCase):
    def test_image(self):
        self.assertEqual(
            resolve_provider_order(has_image=True, msg_lang="en", complex_query=False)[0],
            "gemini",
        )

    def test_gemini_lang(self):
        self.assertEqual(
            resolve_provider_order(has_image=False, msg_lang="ar", complex_query=False)[0],
            "gemini",
        )

    def test_default(self):
        self.assertEqual(
            resolve_provider_order(has_image=False, msg_lang="el", complex_query=False)[0],
            "grok",
        )

    def test_places_beats_default_and_complex(self):
        self.assertEqual(
            resolve_provider_order(
                has_image=False,
                msg_lang="el",
                complex_query=True,
                places_query=True,
            )[0],
            "gemini",
        )

    def test_image_beats_places(self):
        self.assertEqual(
            resolve_provider_order(
                has_image=True,
                msg_lang="el",
                complex_query=False,
                places_query=True,
            )[0],
            "gemini",
        )
        self.assertEqual(
            resolve_provider_order(
                has_image=True,
                msg_lang="el",
                complex_query=False,
                places_query=True,
            ),
            DEFAULT_LLM_ROUTING["image_order"],
        )


class ComplexTests(unittest.TestCase):
    def test_keyword(self):
        self.assertTrue(is_complex_message("I have a fever tonight"))

    def test_length(self):
        self.assertTrue(is_complex_message("x" * 301))
        self.assertFalse(is_complex_message("hello"))


class PlacesTests(unittest.TestCase):
    def test_english(self):
        self.assertTrue(is_places_message("Find me a pediatrician near me"))
        self.assertTrue(is_places_message("pharmacy nearby"))
        self.assertTrue(is_places_message("Give me a list of doctors in Athens"))
        self.assertTrue(is_places_message("list of pediatricians near Kolonaki"))

    def test_greek(self):
        self.assertTrue(is_places_message("Βρες μου παιδίατρο κοντά μου"))
        self.assertTrue(is_places_message("Υπάρχει φαρμακείο κοντά μου;"))
        self.assertTrue(is_places_message("Θέλω λίστα γιατρών στην Αθήνα"))
        self.assertTrue(is_places_message("Πού να βρω παιδίατρο;"))
        self.assertTrue(
            is_places_message("καλησπέρα μπορείς να μου βρεις παιδιατρους στη ηλιουπολή;")
        )
        self.assertFalse(is_places_message("Ο παιδίατρος είπε να κοιμάται περισσότερο"))

    def test_non_places(self):
        self.assertFalse(is_places_message("How is sleep at 3 months?"))
        self.assertFalse(is_places_message("What does a doctor do for fever?"))


if __name__ == "__main__":
    unittest.main()
