-- Plans catalog (from frontend home pricing) + users.plan_id FK.
-- Run in the Supabase SQL editor.
-- Keeps legacy users.plan text; plan_id is the normalized FK (trial|starter|premium|annual).

CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_label text,
  period_label text,
  badge text,
  sort_order integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  voice_listen_quota integer,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed / upsert from home page pricing (en/home.json)
INSERT INTO public.plans (
  id, name, price_label, period_label, badge, sort_order, featured, voice_listen_quota, icon
) VALUES
  ('trial',   'Free Trial',      'Free', '14 days', NULL,         10, false, 50,  '✨'),
  ('starter', 'Starter',         '€19',  '/month',  NULL,         20, false, 150, '⚡'),
  ('premium', 'Premium',         '€39',  '/month',  'Popular',    30, true,  400, '👑'),
  ('annual',  'Annual Premium',  '€199', '/year',   'Save 57%',   40, false, 700, '💎')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_label = EXCLUDED.price_label,
  period_label = EXCLUDED.period_label,
  badge = EXCLUDED.badge,
  sort_order = EXCLUDED.sort_order,
  featured = EXCLUDED.featured,
  voice_listen_quota = EXCLUDED.voice_listen_quota,
  icon = EXCLUDED.icon,
  updated_at = now(),
  active = true;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan_id text;

-- Backfill plan_id from legacy users.plan name / slot
UPDATE public.users
SET plan_id = CASE
  WHEN plan IS NULL OR btrim(plan) = '' THEN 'trial'
  WHEN lower(plan) IN ('trial', 'free', 'free trial') THEN 'trial'
  WHEN lower(plan) LIKE '%annual%'
    OR lower(plan) LIKE '%year%'
    OR plan LIKE '%ετήσ%' THEN 'annual'
  WHEN lower(plan) LIKE '%premium%' THEN 'premium'
  WHEN lower(plan) LIKE '%starter%' THEN 'starter'
  WHEN lower(subscription_status) = 'trial' THEN 'trial'
  WHEN lower(subscription_status) = 'active' THEN 'starter'
  ELSE 'trial'
END
WHERE plan_id IS NULL
   OR plan_id NOT IN (SELECT id FROM public.plans);

UPDATE public.users
SET plan_id = 'trial'
WHERE plan_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_plan_id_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.plans(id);
  END IF;
END $$;

ALTER TABLE public.users
  ALTER COLUMN plan_id SET DEFAULT 'trial';

-- Prefer NOT NULL once backfill succeeded
ALTER TABLE public.users
  ALTER COLUMN plan_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS users_plan_id_idx ON public.users (plan_id);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
