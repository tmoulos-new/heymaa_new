-- Soft opt-in for lock-screen / browser push alerts (not the browser permission itself).
-- Run once in the Supabase SQL editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_alerts_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_alerts_opt_in_at timestamptz;
