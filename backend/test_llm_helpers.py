import unittest

from main import _is_usable_reply
from replicate_chat import looks_truncated_reply


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


if __name__ == "__main__":
    unittest.main()
