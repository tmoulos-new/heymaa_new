-- Last meaningful activity (chat, saves, navigation, login/signup).
-- Distinct from last_login (auth events only). Run in Supabase SQL Editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_active timestamptz;

UPDATE public.users
SET last_active = COALESCE(last_login, created_at)
WHERE last_active IS NULL;

CREATE INDEX IF NOT EXISTS users_last_active_idx
  ON public.users (last_active DESC NULLS LAST);

NOTIFY pgrst, 'reload schema';
