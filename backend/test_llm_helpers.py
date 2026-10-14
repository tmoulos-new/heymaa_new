import unittest

from main import _is_usable_reply
from llm_reply import looks_truncated_reply


class LlmReplyQualityTests(unittest.TestCase):
    def test_accepts_normal_greeting(self):
        self.assertTrue(_is_usable_reply("Καλημέρα! Πώς μπορεί να βοηθήσει σήμερα;"))

    def test_rejects_instruction_leak_bullets(self):
        self.assertFalse(_is_usable_reply("* used? Yes. * Tone: Warm, professional? Yes."))

    def test_rejects_short_empty(self):
        self.assertFalse(_is_usable_reply("ok"))

    def test_rejects_truncated_mid_sentence(self):
        self.assertTrue(looks_truncated_reply("Γιώργο, τώρα που μόλις γέννησες, είναι"))
        self.assertFalse(_is_usable_reply("Γιώργο, τώρα που μόλις γέννησες, είναι"))

    def test_rejects_truncated_trailing_comma(self):
        self.assertTrue(looks_truncated_reply("Είμαι έτοιμη να σε βοηθήσω με ό,"))
        self.assertFalse(_is_usable_reply("Είμαι έτοιμη να σε βοηθήσω με ό,"))

    def test_accepts_complete_sentences(self):
        self.assertFalse(looks_truncated_reply("Είμαι εδώ για να σε βοηθήσω. Πες μου τι χρειάζεσαι."))


class ProfileContextTests(unittest.TestCase):
    def test_lists_children_members_and_add_child_path(self):
        from types import SimpleNamespace
        from main import _APP_NAV_RULE, build_profile_context, build_system_prompt

        profile = SimpleNamespace(
            name="Ελένη",
            lang="el",
            childName=None,
            childAge=None,
            childBirthDate=None,
            dueDate=None,
            country="GR",
            city="Athens",
            children=[
                SimpleNamespace(name="Άννα", birthDate="2025-08-01", gender="girl"),
            ],
            familyMembers=[
                SimpleNamespace(name="Νίκος", relationship="Partner", birthDate=None, note=None),
            ],
        )
        ctx = build_profile_context(profile)
        self.assertIn("Άννα", ctx)
        self.assertIn("girl", ctx)
        self.assertIn("Νίκος", ctx)
        self.assertIn("Athens", ctx)
        self.assertIn("Family → My Family → ＋ Add child", ctx)

        prompt = build_system_prompt("", ctx)
        self.assertIn("Οικογένεια", _APP_NAV_RULE)
        self.assertIn("＋ Πρόσθεσε παιδί", prompt)
        self.assertIn("Άννα", prompt)
        self.assertIn("Greetings and language", prompt)
        self.assertIn("ύπνος", prompt)
        self.assertIn("Χαίρετε", prompt)
        self.assertIn("Χαίρομαι", prompt)
        self.assertIn("do not volunteer the name", ctx)
        self.assertIn("τον Μάριο", ctx)
        self.assertIn("μηνών", ctx)
        self.assertIn("Greek personal names", prompt)
        self.assertIn("Greek age phrasing", prompt)
        self.assertIn("τον Μάριο", prompt)
        self.assertNotIn("do not transliterate, translate, Hellenize, decline", ctx)

    def test_empty_family_explains_add_child_path(self):
        from types import SimpleNamespace
        from main import build_profile_context

        profile = SimpleNamespace(
            name="Maria",
            lang="en",
            childName="",
            childAge="",
            childBirthDate=None,
            dueDate=None,
            children=[],
            familyMembers=[],
        )
        ctx = build_profile_context(profile)
        self.assertIn("not registered any children", ctx)
        self.assertIn("Πρόσθεσε παιδί", ctx)


class LanguageLeakScrubTests(unittest.TestCase):
    def test_replaces_sleep_garble_in_greek(self):
        from main import _scrub_language_leaks

        src = (
            "Γιώργο, είμαι εδώ για να σου προσφέρω υποστήριξη σχετικά με τη διατροφή, "
            "το σLEEP και την ανάπτυξη του Πανού."
        )
        out = _scrub_language_leaks(src, "el")
        self.assertNotIn("SLEEP", out)
        self.assertNotIn("σLEEP", out)
        self.assertIn("ύπνο", out)

    def test_leaves_english_replies_alone(self):
        from main import _scrub_language_leaks

        src = "I can help with sleep and nutrition."
        self.assertEqual(_scrub_language_leaks(src, "en"), src)

    def test_fixes_smashed_greek_age(self):
        from main import _scrub_language_leaks

        src = "Ο Μάριος είναι τριώνμης ηλικίας, και μεγαλώνει καλά."
        out = _scrub_language_leaks(src, "el")
        self.assertNotIn("τριώνμης", out)
        self.assertIn("τριών μηνών", out)

    def test_fixes_formal_chairete_opening(self):
        from main import _scrub_language_leaks

        src = (
            "Χαίρετε! Ελπίζω η επιστροφή στο σχολείο να έχει γίνει ομαλή "
            "και να έχετε ξεκινήσει την εργάσιμη μέρα με ενέργεια."
        )
        out = _scrub_language_leaks(src, "el")
        self.assertTrue(out.startswith("Χαίρομαι"))
        self.assertNotIn("Χαίρετε", out)


class LlmHistoryTests(unittest.TestCase):
    _pitch = (
        "Γιώργο, είμαι εδώ για να σου προσφέρω υποστήριξη και πληροφορίες σχετικά "
        "με τη διατροφή, το ύπνο και την ανάπτυξη του Πανού."
    )

    def test_greeting_drops_thread_like_admin(self):
        from main import prepare_llm_history

        history = [
            {"role": "user", "content": "γεια"},
            {"role": "assistant", "content": self._pitch},
        ]
        self.assertEqual(prepare_llm_history("Τι κάνεις;", history), [])

    def test_real_question_keeps_non_pitch_turns(self):
        from main import prepare_llm_history

        history = [
            {"role": "user", "content": "γεια"},
            {"role": "assistant", "content": self._pitch},
            {"role": "user", "content": "πόσο είναι ο Πάνος;"},
            {"role": "assistant", "content": "Ο Πάνος είναι 11 μηνών."},
        ]
        out = prepare_llm_history("πώς κοιμάται ο Πάνος;", history)
        contents = [h["content"] for h in out]
        self.assertNotIn(self._pitch, contents)
        self.assertIn("Ο Πάνος είναι 11 μηνών.", contents)
        self.assertIn("πόσο είναι ο Πάνος;", contents)

    def test_topic_how_to_keeps_history(self):
        from main import prepare_llm_history

        history = [
            {"role": "user", "content": "ο μικρός βήχει"},
            {"role": "assistant", "content": "Παρακολούθησε τον πυρετό."},
        ]
        out = prepare_llm_history("τι κάνεις με τον βήχα;", history)
        self.assertTrue(out)
        self.assertIn("ο μικρός βήχει", [h["content"] for h in out])


class PriorTopicAndSourcesTests(unittest.TestCase):
    def test_asks_for_sources_meta_only(self):
        from main import asks_for_sources

        self.assertTrue(asks_for_sources("δωσε που πηγές"))
        self.assertTrue(asks_for_sources("show me the sources"))
        self.assertFalse(asks_for_sources("τι λένε οι πηγές για τα εμβόλια;"))
        self.assertFalse(asks_for_sources("what do the sources say about fever?"))

    def test_previous_skips_thanks_and_followups(self):
        from main import previous_substantive_question

        history = [
            {"role": "user", "content": "μπορείς να μου πεις το πρόγραμμα έως 12 μηνών?"},
            {"role": "assistant", "content": "Το εθνικό πρόγραμμα…"},
            {"role": "user", "content": "ευχαριστώ"},
            {"role": "assistant", "content": "Παρακαλώ!"},
            {"role": "user", "content": "δωσε μου τα βασικά"},
            {"role": "assistant", "content": "Τα βασικά…"},
        ]
        self.assertEqual(
            previous_substantive_question(history),
            "μπορείς να μου πεις το πρόγραμμα έως 12 μηνών?",
        )

    def test_normalize_client_sources(self):
        from main import normalize_client_chat_sources

        out = normalize_client_chat_sources(
            [
                {"title": "MOH", "url": "https://example.com/a"},
                {"title": "dup", "url": "https://example.com/a?x=1"},
                {"title": "bad", "url": "not-a-url"},
            ]
        )
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["url"], "https://example.com/a")


if __name__ == "__main__":
    unittest.main()
