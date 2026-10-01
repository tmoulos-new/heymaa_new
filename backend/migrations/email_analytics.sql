-- Email send log + Resend webhook events for campaign / transactional reports.
-- Run in the Supabase SQL editor, then point Resend webhooks at POST /webhooks/resend
-- (events: email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained).

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

CREATE INDEX IF NOT EXISTS email_sends_created_at_idx
  ON public.email_sends (created_at DESC);
CREATE INDEX IF NOT EXISTS email_sends_kind_created_idx
  ON public.email_sends (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS email_sends_campaign_idx
  ON public.email_sends (campaign_id)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_sends_to_email_idx
  ON public.email_sends (to_email);

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

CREATE INDEX IF NOT EXISTS email_events_resend_id_idx
  ON public.email_events (resend_id, event_type);
CREATE INDEX IF NOT EXISTS email_events_occurred_at_idx
  ON public.email_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS email_events_type_occurred_idx
  ON public.email_events (event_type, occurred_at DESC);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
