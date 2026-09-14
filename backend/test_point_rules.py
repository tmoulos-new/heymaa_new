"""Unit tests for admin-editable point rules helpers."""

import unittest

import main as m


class PointRulesTests(unittest.TestCase):
    def setUp(self):
        m._invalidate_point_rules_cache()
        m._point_rules_cache = [dict(r) for r in m.DEFAULT_POINT_RULE_ROWS]
        m._point_settings_cache = {k: dict(v) for k, v in m.DEFAULT_POINT_SETTINGS.items()}
        m._point_rules_table_ready = True

    def tearDown(self):
        m._invalidate_point_rules_cache()

    def test_default_note_points(self):
        self.assertEqual(m._points_for_activity("submit", "/app/memories/add-note"), 2)

    def test_uncheck_follows_check_if_missing(self):
        m._point_rules_cache = [
            r for r in m._point_rules_cache if r.get("path") != m.MILESTONE_UNCHECK_PATH
        ]
        self.assertEqual(m._points_for_activity("submit", m.MILESTONE_UNCHECK_PATH), -15)

    def test_public_payload_hides_internal_rows(self):
        payload = m._public_point_rules_payload()
        paths = [a["path"] for a in payload["actions"]]
        self.assertIn("/app/memories/add-note", paths)
        self.assertNotIn("/app/milestones/uncheck", paths)
        self.assertEqual(payload["referral_bonus_points"], 40)
        self.assertEqual(payload["chat_daily_points_cap"], 30)
        self.assertEqual(payload["lookup"]["/app/milestones/uncheck"], -15)

    def test_live_chat_cap(self):
        m._point_settings_cache["chat_daily_points_cap"]["value_int"] = 12
        self.assertEqual(m._chat_daily_points_cap(), 12)


if __name__ == "__main__":
    unittest.main()
