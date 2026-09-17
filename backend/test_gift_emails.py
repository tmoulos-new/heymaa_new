from email_templates import (
    render_level_gift_activated_email,
    render_level_gift_won_email,
)
from gift_emails import newly_unlocked_gifts
from plan_grants import LEVEL_REWARD_GRANTS


def test_newly_unlocked_gifts_only_new_unclaimed():
    mapping = {int(k): dict(v) for k, v in LEVEL_REWARD_GRANTS.items()}
    gifts = newly_unlocked_gifts(1, 3, mapping, claimed={2})
    assert [g["level_id"] for g in gifts] == [3]
    assert newly_unlocked_gifts(1, 1, mapping, claimed=set()) == []


def test_gift_won_email_el_asks_to_claim():
    msg = render_level_gift_won_email(
        name="Μαρία",
        gifts=[{"days": 3, "plan_slot": "starter", "level_name": "Ενεργή Μαμά"}],
        level_name="Ενεργή Μαμά",
        app_url="https://www.heymaa.ai",
        lang="el",
    )
    assert "Ξεκλείδωσες ένα δώρο" in msg.subject
    assert "Πάρε το δώρο σου" in msg.html
    assert "3 μέρες δωρεάν Starter" in msg.html
    assert "/app" in msg.html


def test_gift_activated_email_en_confirms_grant():
    msg = render_level_gift_activated_email(
        name="Maria",
        days=7,
        plan_slot="premium",
        level_name="Dedicated Mom",
        upgraded=True,
        starts_at="2026-10-20T00:00:00+00:00",
        ends_at="2026-10-27T00:00:00+00:00",
        app_url="https://www.heymaa.ai",
        lang="en",
    )
    assert "gift is active" in msg.subject.lower()
    assert "7 days free Premium" in msg.html
    assert "not a downgrade" in msg.html
