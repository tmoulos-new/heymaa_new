#!/usr/bin/env python3
"""Apply HeyMaa SQL migrations to a Supabase Postgres database.

Usage:
  set DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
  python backend/scripts/apply_migrations.py
  python backend/scripts/apply_migrations.py --bootstrap-only
  python backend/scripts/apply_migrations.py --skip-bootstrap

Reads DATABASE_URL or SUPABASE_DB_URL from the environment (or backend/.env).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "migrations"

# Legacy renames / orphan cleanup — skip on greenfield after 000_bootstrap_core.sql
SKIP_ON_GREENFIELD = {
    "rename_admin_messages_to_offer_news.sql",
    "rename_offer_news_to_offers.sql",
    "users_auth_orphan_cleanup.sql",
    "users_password_hash_nullable.sql",
    "users_drop_password_hash.sql",
    "users_to_supabase_auth.sql",  # FK + RLS already in bootstrap
    "plans_and_users_plan_id.sql",
    "plans_product.sql",
    "plans_tx_stats.sql",
    "plans_tx_limits.sql",
    "user_levels.sql",
    "user_levels_level_fk.sql",
    "levels_reward_gift.sql",
    "profiles_auth_user_id.sql",
    "profiles_signup_consents.sql",
    "user_data_auth_user_id.sql",
    "push_alerts_opt_in.sql",
    "users_role.sql",
    "users_must_change_password.sql",
    "users_last_active.sql",
    "users_subscription_ends_at.sql",
    "users_trial_14_days.sql",
    "regions.sql",
    "is_deleted_soft_delete.sql",
    "content_user_id.sql",
    "add_offer_promotion_images.sql",
    "promotions_id_to_uuid.sql",
    "regions_fix_offer_id_uuid.sql",
    "invite_codes_rls_policies.sql",
    "point_rules.sql",
    "gift_codes.sql",
    "support_messages.sql",
    "app_notifications.sql",
    "completed_orders.sql",
    "activity_log.sql",
    "llm_transactions.sql",
    "plan_grants.sql",
    "storage_buckets_rls_policies.sql",
    "point_transactions_allow_negative.sql",  # amount has no CHECK > 0 in bootstrap
}


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)


def ordered_sql_files(*, bootstrap_only: bool, skip_bootstrap: bool) -> list[Path]:
    files = sorted(MIGRATIONS.glob("*.sql"))
    bootstrap = MIGRATIONS / "000_bootstrap_core.sql"
    out: list[Path] = []
    if not skip_bootstrap and bootstrap.exists():
        out.append(bootstrap)
    if bootstrap_only:
        return out
    for f in files:
        if f.name == "000_bootstrap_core.sql":
            continue
        if f.name in SKIP_ON_GREENFIELD:
            continue
        out.append(f)
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bootstrap-only", action="store_true")
    parser.add_argument("--skip-bootstrap", action="store_true")
    args = parser.parse_args()

    load_dotenv()
    db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("DATABASE_URL / SUPABASE_DB_URL required", file=sys.stderr)
        return 1

    try:
        import psycopg
    except ImportError:
        print("Install psycopg: pip install 'psycopg[binary]'", file=sys.stderr)
        return 1

    files = ordered_sql_files(
        bootstrap_only=args.bootstrap_only,
        skip_bootstrap=args.skip_bootstrap,
    )
    if not files:
        print("No migration files to apply")
        return 1

    print(f"Applying {len(files)} SQL file(s)…")
    with psycopg.connect(db_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            for path in files:
                sql = path.read_text(encoding="utf-8")
                print(f"  → {path.name}")
                try:
                    cur.execute(sql)
                except Exception as e:
                    print(f"FAIL {path.name}: {e}", file=sys.stderr)
                    return 1
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
