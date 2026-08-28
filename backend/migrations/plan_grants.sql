-- Optional: plan grants can also live in user_data (plan_grants / level_rewards_claimed).
-- This table supports admin reporting and future cron jobs.

CREATE TABLE IF NOT EXISTS public.plan_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_slot text NOT NULL CHECK (plan_slot IN ('starter', 'premium')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  source text NOT NULL,
  level_id smallint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_grants_user_id_idx ON public.plan_grants (user_id);
CREATE INDEX IF NOT EXISTS plan_grants_ends_at_idx ON public.plan_grants (ends_at);

CREATE UNIQUE INDEX IF NOT EXISTS plan_grants_user_level_reward_uidx
  ON public.plan_grants (user_id, level_id)
  WHERE level_id IS NOT NULL;
