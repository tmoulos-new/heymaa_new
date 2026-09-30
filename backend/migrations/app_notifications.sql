-- In-app inbox + Web Push subscriptions for admin marketing messages.
-- Run once in the Supabase SQL editor.

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

CREATE INDEX IF NOT EXISTS idx_app_notification_recipients_user
  ON public.app_notification_recipients (user_id, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
