-- Optional tables not covered by 000_bootstrap_core.sql.
-- Safe to re-run after greenfield bootstrap. Does not create rag_sources/rag_chunks
-- (those need a dedicated vector baseline + HNSW setup).

CREATE TABLE IF NOT EXISTS public.chat_prompt_settings (
  key text PRIMARY KEY,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS chat_prompt_settings_updated_at_idx
  ON public.chat_prompt_settings (updated_at DESC);
ALTER TABLE public.chat_prompt_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token text,
  action text NOT NULL,
  path text NOT NULL,
  label text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_activity_log_actor_check CHECK (user_id IS NOT NULL OR token IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS user_activity_log_created_at_idx ON public.user_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_user_id_idx ON public.user_activity_log (user_id);
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id text UNIQUE,
  kind text NOT NULL DEFAULT 'transactional',
  campaign_id uuid,
  user_id uuid,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_sends_created_at_idx ON public.email_sends (created_at DESC);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id text NOT NULL,
  event_type text NOT NULL,
  to_email text,
  link text,
  user_agent text,
  ip text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_events_resend_id_idx ON public.email_events (resend_id, event_type);
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  url text,
  audience text NOT NULL DEFAULT 'selected',
  audience_label text,
  status text NOT NULL DEFAULT 'sending',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  recipient_count int NOT NULL DEFAULT 0,
  delivered int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  last_error text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.admin_email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.llm_usage_events (
  id bigint generated ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  model text,
  ok boolean NOT NULL DEFAULT true,
  est_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  predict_time_ms integer,
  error_kind text
);
ALTER TABLE public.llm_usage_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rag_seed_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'discovering', 'running', 'completed', 'failed', 'cancelled')),
  since_years double precision DEFAULT 5,
  batch_size int NOT NULL DEFAULT 5,
  discover_page int NOT NULL DEFAULT 1,
  max_discover_pages int NOT NULL DEFAULT 250,
  urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  cursor_idx int NOT NULL DEFAULT 0,
  discovered int NOT NULL DEFAULT 0,
  ingested int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  last_error text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rag_seed_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  user_id uuid,
  user_message text NOT NULL DEFAULT '',
  assistant_reply text NOT NULL DEFAULT '',
  lang text,
  provider text,
  needs_rag boolean,
  request_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  user_id uuid,
  vote text NOT NULL CHECK (vote IN ('up', 'down')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

NOTIFY pgrst, 'reload schema';
