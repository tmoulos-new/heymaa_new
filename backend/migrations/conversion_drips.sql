-- Admin-editable conversion drip sequences (never-paid → subscribe).
-- Run in Supabase SQL editor (or apply_migrations).

CREATE TABLE IF NOT EXISTS public.conversion_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  -- Who gets enrolled automatically by the daily cron
  trigger_type text NOT NULL DEFAULT 'never_paid_trial'
    CHECK (trigger_type IN ('never_paid_trial', 'manual')),
  langs text[] NOT NULL DEFAULT ARRAY['el']::text[],
  require_marketing_consent boolean NOT NULL DEFAULT true,
  -- Best-practice caps (per user, across this sequence)
  min_hours_between_emails int NOT NULL DEFAULT 168,  -- 7 days
  min_hours_between_push int NOT NULL DEFAULT 72,     -- 3 days
  exit_on_paid boolean NOT NULL DEFAULT true,
  exit_on_gift_claim boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversion_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.conversion_sequences(id) ON DELETE CASCADE,
  step_index int NOT NULL CHECK (step_index >= 0),
  -- Timing
  anchor text NOT NULL DEFAULT 'enrolled_at'
    CHECK (anchor IN ('enrolled_at', 'trial_ends_at')),
  offset_hours int NOT NULL DEFAULT 0,  -- + after anchor, - before (trial_ends_at)
  channel text NOT NULL DEFAULT 'both'
    CHECK (channel IN ('email', 'notification', 'both')),
  -- Email (EmailsTab parity)
  email_subject text,
  email_body text,
  email_url text,
  email_button_label text,
  email_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- In-app + push (NotificationsTab parity)
  notif_title text,
  notif_body text,
  notif_url text,
  -- Optional gift-code CTA (from Gifts tab)
  gift_code text,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (sequence_id, step_index)
);

CREATE INDEX IF NOT EXISTS conversion_sequence_steps_seq_idx
  ON public.conversion_sequence_steps (sequence_id, step_index);

CREATE TABLE IF NOT EXISTS public.conversion_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES public.conversion_sequences(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'exited', 'paused')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  next_step_index int NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  exited_reason text,
  last_step_sent_at timestamptz,
  UNIQUE (sequence_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversion_enrollments_due_idx
  ON public.conversion_enrollments (status, next_run_at);

CREATE INDEX IF NOT EXISTS conversion_enrollments_user_idx
  ON public.conversion_enrollments (user_id);

CREATE TABLE IF NOT EXISTS public.conversion_drip_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.conversion_enrollments(id) ON DELETE SET NULL,
  sequence_id uuid NOT NULL,
  step_id uuid NOT NULL,
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'notification')),
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'skipped')),
  subject_or_title text,
  body text,
  url text,
  notification_id uuid,
  last_error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversion_drip_sends_user_sent_idx
  ON public.conversion_drip_sends (user_id, channel, sent_at DESC);

CREATE INDEX IF NOT EXISTS conversion_drip_sends_seq_idx
  ON public.conversion_drip_sends (sequence_id, sent_at DESC);

ALTER TABLE public.conversion_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_drip_sends ENABLE ROW LEVEL SECURITY;
