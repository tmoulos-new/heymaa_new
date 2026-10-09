-- HeyMaa greenfield bootstrap for a fresh Supabase project.
-- Creates core tables in their final (post-migration) shape.
-- Safe to re-run (IF NOT EXISTS / ON CONFLICT). Apply remaining
-- additive migrations afterward via scripts/apply_migrations.py.
--
-- Run in Supabase SQL Editor, or: python backend/scripts/apply_migrations.py --bootstrap-only

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── plans ──────────────────────────────────────────────────────────────────
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
  product text,
  tx_count integer NOT NULL DEFAULT 0,
  tx_cost_usd numeric(14, 6) NOT NULL DEFAULT 0,
  tx_limit integer,
  tx_cost_limit_usd numeric(14, 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.plans (
  id, name, price_label, period_label, badge, sort_order, featured,
  voice_listen_quota, icon, product, tx_limit, tx_cost_limit_usd
) VALUES
  ('trial',   'Free Trial',     'Free',    '14 days', NULL,       10, false, 50,  '✨', NULL,          100,  1.0000),
  ('starter', 'Starter',        '€13.99',  '/month',  NULL,       20, false, 150, '⚡', 'HM-STARTER',  500,  5.0000),
  ('premium', 'Premium',        '€24.99',  '/month',  'Popular',  30, true,  400, '👑', 'HM-PREMIUM',  2000, 20.0000),
  ('annual',  'Annual Premium', '€119.99', '/year',   'Save 57%', 40, false, 700, '💎', 'HM-APREMIUM', 5000, 50.0000)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_label = EXCLUDED.price_label,
  period_label = EXCLUDED.period_label,
  badge = EXCLUDED.badge,
  sort_order = EXCLUDED.sort_order,
  featured = EXCLUDED.featured,
  voice_listen_quota = EXCLUDED.voice_listen_quota,
  icon = EXCLUDED.icon,
  product = COALESCE(EXCLUDED.product, public.plans.product),
  tx_limit = COALESCE(EXCLUDED.tx_limit, public.plans.tx_limit),
  tx_cost_limit_usd = COALESCE(EXCLUDED.tx_cost_limit_usd, public.plans.tx_cost_limit_usd),
  updated_at = now(),
  active = true;

-- ── levels ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.levels (
  id smallint PRIMARY KEY,
  sort_order smallint NOT NULL UNIQUE,
  min_points int NOT NULL CHECK (min_points >= 0),
  name_el text NOT NULL,
  name_en text NOT NULL,
  reward_plan_slot text,
  reward_days int,
  CONSTRAINT levels_reward_plan_slot_check
    CHECK (reward_plan_slot IS NULL OR reward_plan_slot IN ('starter', 'premium')),
  CONSTRAINT levels_reward_days_check
    CHECK (reward_days IS NULL OR reward_days > 0)
);

INSERT INTO public.levels (id, sort_order, min_points, name_el, name_en, reward_plan_slot, reward_days) VALUES
  (1, 1, 0,    'Νέα Μαμά',         'New Mom',          NULL,      NULL),
  (2, 2, 250,  'Ενεργή Μαμά',      'Active Mom',       'starter', 3),
  (3, 3, 750,  'Αφοσιωμένη Μαμά',  'Dedicated Mom',    'starter', 7),
  (4, 4, 1500, 'Super Μαμά',       'Super Mom',        'premium', 3),
  (5, 5, 2500, 'HeyMaa Champion',  'HeyMaa Champion',  'premium', 7)
ON CONFLICT (id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  min_points = EXCLUDED.min_points,
  name_el = EXCLUDED.name_el,
  name_en = EXCLUDED.name_en,
  reward_plan_slot = COALESCE(EXCLUDED.reward_plan_slot, public.levels.reward_plan_slot),
  reward_days = COALESCE(EXCLUDED.reward_days, public.levels.reward_days);

-- ── users (id matches auth.users.id) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  plan text DEFAULT 'trial',
  plan_id text NOT NULL DEFAULT 'trial' REFERENCES public.plans(id),
  subscription_status text DEFAULT 'trial',
  trial_ends_at timestamptz,
  subscription_ends_at timestamptz,
  invite_code text,
  role text,
  level_id smallint NOT NULL DEFAULT 1 REFERENCES public.levels(id),
  must_change_password boolean NOT NULL DEFAULT false,
  last_login timestamptz,
  last_active timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON public.users (lower(email));
CREATE INDEX IF NOT EXISTS users_plan_id_idx ON public.users (plan_id);
CREATE INDEX IF NOT EXISTS users_level_id_idx ON public.users (level_id);

-- ── profiles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  country text,
  city text,
  zip text,
  address_street text,
  address_zip text,
  address_city text,
  address_country text,
  child_count integer DEFAULT 0,
  children_birthdates jsonb,
  pregnancy_active boolean NOT NULL DEFAULT false,
  want_child boolean NOT NULL DEFAULT false,
  consent_marketing boolean NOT NULL DEFAULT false,
  consent_date timestamptz,
  consent_privacy boolean NOT NULL DEFAULT false,
  consent_privacy_at timestamptz,
  consent_terms boolean NOT NULL DEFAULT false,
  consent_terms_at timestamptz,
  push_alerts_opt_in boolean NOT NULL DEFAULT false,
  push_alerts_opt_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_token_or_user_id_check
    CHECK (token IS NOT NULL OR user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique
  ON public.profiles (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_token_unique
  ON public.profiles (token) WHERE token IS NOT NULL;

-- ── user_data (KV store) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_data_token_or_user_id_check
    CHECK (token IS NOT NULL OR user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_data_user_id_key_unique
  ON public.user_data (user_id, key) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_data_token_key_unique
  ON public.user_data (token, key) WHERE token IS NOT NULL;

-- ── invite codes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  label text,
  notes text,
  expires_at timestamptz,
  user_id uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invite_codes_status_check
    CHECK (status IN ('active', 'inactive', 'expired'))
);

INSERT INTO public.invite_codes (code, status, label)
SELECT
  'HeyMaa_Tester' || lpad(i::text, 2, '0'),
  'active',
  'Beta tester ' || lpad(i::text, 2, '0')
FROM generate_series(1, 30) AS i
ON CONFLICT (code) DO NOTHING;

-- ── regions / offers / promotions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  languages text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS regions_name_lower_idx
  ON public.regions (lower(trim(name)));

INSERT INTO public.regions (name, languages, active)
SELECT v.name, v.languages, v.active
FROM (
  VALUES
    ('Greece & Cyprus', ARRAY['el', 'en']::text[], true),
    ('Global (English)', ARRAY['en']::text[], true),
    ('Romania', ARRAY['ro', 'en']::text[], true)
) AS v(name, languages, active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.regions r WHERE lower(trim(r.name)) = lower(trim(v.name))
);

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  lang text DEFAULT 'all',
  badge text,
  link text,
  expires_at timestamptz,
  image_key text,
  active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  badge text DEFAULT 'sponsored',
  link text,
  target_countries jsonb,
  target_cities jsonb,
  target_zips jsonb,
  child_count_min integer,
  child_count_max integer,
  target_pregnancy boolean,
  child_age_min_months integer,
  child_age_max_months integer,
  expires_at timestamptz,
  image_key text,
  active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offer_regions (
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, region_id)
);
CREATE INDEX IF NOT EXISTS offer_regions_region_id_idx ON public.offer_regions (region_id);

CREATE TABLE IF NOT EXISTS public.promotion_regions (
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, region_id)
);
CREATE INDEX IF NOT EXISTS promotion_regions_region_id_idx ON public.promotion_regions (region_id);

-- ── gamification ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount int NOT NULL,
  reason text NOT NULL,
  action text,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS point_transactions_user_id_idx
  ON public.point_transactions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.user_total_points(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)::int
  FROM public.point_transactions
  WHERE user_id = p_user_id;
$$;

CREATE TABLE IF NOT EXISTS public.point_rules (
  id smallint PRIMARY KEY,
  action text NOT NULL,
  path text NOT NULL,
  points int NOT NULL,
  label_el text NOT NULL,
  label_en text NOT NULL,
  sort_order smallint NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  UNIQUE (action, path)
);

INSERT INTO public.point_rules
  (id, action, path, points, label_el, label_en, sort_order, visible)
VALUES
  (1, 'submit',   '/app/memories/add-note',   2,  'Σημείωση',            'Note',               1, true),
  (2, 'submit',   '/app/memories/add-photo',  5,  'Φωτό',                'Photo',              2, true),
  (3, 'submit',   '/app/memories/add-video',  8,  'Βίντεο',              'Video',              3, true),
  (4, 'submit',   '/app/chat/send',           3,  'Chat',                'Chat',               4, true),
  (5, 'submit',   '/app/chat/send-video',     8,  'Chat βίντεο',         'Chat video',         5, false),
  (6, 'submit',   '/app/milestones/check',   15,  'Ορόσημο',             'Milestone',          6, true),
  (7, 'submit',   '/app/milestones/uncheck',-15,  'Ξετικάρισμα ορόσημου','Untick milestone',   7, false),
  (8, 'referral', '/auth/register',          40,  'Πρόσκληση φίλης',     'Friend referral',    8, false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.point_settings (
  key text PRIMARY KEY,
  value_int int NOT NULL,
  label_el text NOT NULL,
  label_en text NOT NULL
);

INSERT INTO public.point_settings (key, value_int, label_el, label_en) VALUES
  ('chat_daily_points_cap', 30, 'Ημερήσιο όριο πόντων chat', 'Daily chat points cap')
ON CONFLICT (key) DO NOTHING;

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
  ON public.plan_grants (user_id, level_id) WHERE level_id IS NOT NULL;

-- ── gifts / support / notifications / orders / logs ────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  gift_type text NOT NULL,
  plan_slot text,
  days int,
  points int,
  label text,
  notes text,
  max_claims int,
  claim_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gift_codes_status_check CHECK (status IN ('active', 'inactive', 'expired')),
  CONSTRAINT gift_codes_type_check CHECK (gift_type IN ('free_plan_days', 'bonus_points', 'combo')),
  CONSTRAINT gift_codes_plan_slot_check CHECK (plan_slot IS NULL OR plan_slot IN ('starter', 'premium')),
  CONSTRAINT gift_codes_days_check CHECK (days IS NULL OR days > 0),
  CONSTRAINT gift_codes_points_check CHECK (points IS NULL OR points <> 0),
  CONSTRAINT gift_codes_max_claims_check CHECK (max_claims IS NULL OR max_claims > 0)
);

CREATE TABLE IF NOT EXISTS public.gift_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_code_id uuid NOT NULL REFERENCES public.gift_codes(id) ON DELETE CASCADE,
  code text NOT NULL,
  user_id uuid NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  result jsonb,
  CONSTRAINT gift_claims_unique_user UNIQUE (gift_code_id, user_id)
);
CREATE INDEX IF NOT EXISTS gift_claims_user_idx ON public.gift_claims (user_id);

CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  invite_token text,
  email text NOT NULL,
  name text,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'billing', 'technical', 'privacy', 'other')),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending_user', 'pending_admin', 'closed')),
  locale text DEFAULT 'el',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by text
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user', 'admin', 'system')),
  sender_admin_id text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  url text,
  audience text NOT NULL DEFAULT 'selected',
  audience_label text,
  status text NOT NULL DEFAULT 'sent',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  recipient_count int NOT NULL DEFAULT 0,
  push_attempted int NOT NULL DEFAULT 0,
  push_delivered int NOT NULL DEFAULT 0,
  push_failed int NOT NULL DEFAULT 0,
  last_error text
);

CREATE TABLE IF NOT EXISTS public.app_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.app_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.completed_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL UNIQUE,
  order_code text,
  status text NOT NULL DEFAULT 'completed',
  status_id text,
  completed_at timestamptz NOT NULL,
  email text,
  full_name text,
  phone text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  currency_code integer DEFAULT 978,
  plan text,
  product text,
  customer_trns text,
  merchant_trns text,
  user_id uuid,
  address_street text,
  address_number text,
  address_zip text,
  address_city text,
  address_country text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  value_before jsonb,
  value_after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.llm_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  purpose text NOT NULL DEFAULT 'chat',
  provider text NOT NULL,
  model text,
  ok boolean NOT NULL DEFAULT true,
  cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  latency_ms integer,
  predict_time_ms integer,
  input_chars integer,
  output_chars integer,
  user_id uuid,
  request_id text,
  error_kind text,
  error_msg text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ── storage buckets for offer/promotion images ─────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('offers', 'offers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('promotions', 'promotions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── RLS (backend uses service role; policies for client access) ────────────
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completed_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own row" ON public.users;
CREATE POLICY "Users read own row"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users update own row" ON public.users;
CREATE POLICY "Users update own row"
ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile"
ON public.profiles FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own data" ON public.user_data;
CREATE POLICY "Users read own data"
ON public.user_data FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own data" ON public.user_data;
CREATE POLICY "Users manage own data"
ON public.user_data FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated read offers" ON public.offers;
CREATE POLICY "Authenticated read offers"
ON public.offers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert offers" ON public.offers;
CREATE POLICY "Authenticated insert offers"
ON public.offers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anon insert offers" ON public.offers;
CREATE POLICY "Anon insert offers"
ON public.offers FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update offers" ON public.offers;
CREATE POLICY "Authenticated update offers"
ON public.offers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anon update offers" ON public.offers;
CREATE POLICY "Anon update offers"
ON public.offers FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete offers" ON public.offers;
CREATE POLICY "Authenticated delete offers"
ON public.offers FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon delete offers" ON public.offers;
CREATE POLICY "Anon delete offers"
ON public.offers FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Public read offers images" ON storage.objects;
CREATE POLICY "Public read offers images"
ON storage.objects FOR SELECT TO public USING (bucket_id = 'offers');

DROP POLICY IF EXISTS "Authenticated insert offers images" ON storage.objects;
CREATE POLICY "Authenticated insert offers images"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'offers');

DROP POLICY IF EXISTS "Anon insert offers images" ON storage.objects;
CREATE POLICY "Anon insert offers images"
ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'offers');

DROP POLICY IF EXISTS "Authenticated update offers images" ON storage.objects;
CREATE POLICY "Authenticated update offers images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'offers') WITH CHECK (bucket_id = 'offers');

DROP POLICY IF EXISTS "Anon update offers images" ON storage.objects;
CREATE POLICY "Anon update offers images"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'offers') WITH CHECK (bucket_id = 'offers');

DROP POLICY IF EXISTS "Authenticated delete offers images" ON storage.objects;
CREATE POLICY "Authenticated delete offers images"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'offers');

DROP POLICY IF EXISTS "Anon delete offers images" ON storage.objects;
CREATE POLICY "Anon delete offers images"
ON storage.objects FOR DELETE TO anon USING (bucket_id = 'offers');

DROP POLICY IF EXISTS "Public read promotions images" ON storage.objects;
CREATE POLICY "Public read promotions images"
ON storage.objects FOR SELECT TO public USING (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Authenticated insert promotions images" ON storage.objects;
CREATE POLICY "Authenticated insert promotions images"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Anon insert promotions images" ON storage.objects;
CREATE POLICY "Anon insert promotions images"
ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Authenticated update promotions images" ON storage.objects;
CREATE POLICY "Authenticated update promotions images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'promotions') WITH CHECK (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Anon update promotions images" ON storage.objects;
CREATE POLICY "Anon update promotions images"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'promotions') WITH CHECK (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Authenticated delete promotions images" ON storage.objects;
CREATE POLICY "Authenticated delete promotions images"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Anon delete promotions images" ON storage.objects;
CREATE POLICY "Anon delete promotions images"
ON storage.objects FOR DELETE TO anon USING (bucket_id = 'promotions');

NOTIFY pgrst, 'reload schema';
