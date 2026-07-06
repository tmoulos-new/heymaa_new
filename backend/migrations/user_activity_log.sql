-- End-user activity (views, clicks, navigation). Run in Supabase SQL Editor.
-- Distinct from admin audit `activity_log` (inserts, deletes, etc.).

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

CREATE INDEX IF NOT EXISTS user_activity_log_created_at_idx
  ON public.user_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_user_id_idx
  ON public.user_activity_log (user_id);
CREATE INDEX IF NOT EXISTS user_activity_log_token_idx
  ON public.user_activity_log (token);
CREATE INDEX IF NOT EXISTS user_activity_log_action_idx
  ON public.user_activity_log (action);
CREATE INDEX IF NOT EXISTS user_activity_log_path_idx
  ON public.user_activity_log (path);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
