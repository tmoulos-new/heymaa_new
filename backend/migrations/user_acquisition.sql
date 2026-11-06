-- First-party acquisition / UTM attribution on signup (for Pulse + Insights).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS acquisition jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS users_acquisition_source_idx
  ON public.users ((acquisition->>'utm_source'));

CREATE INDEX IF NOT EXISTS users_acquisition_campaign_idx
  ON public.users ((acquisition->>'utm_campaign'));

NOTIFY pgrst, 'reload schema';
