-- History of admin-composed emails. Run once in the Supabase SQL editor.
-- The service role sends mail; this table is only for the admin history screen.

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

ALTER TABLE public.admin_email_campaigns
  ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_admin_email_campaigns_created
  ON public.admin_email_campaigns (created_at DESC);

ALTER TABLE public.admin_email_campaigns ENABLE ROW LEVEL SECURITY;
