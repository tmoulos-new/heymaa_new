-- Admin activity audit log. Run in Supabase SQL Editor.

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

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_user_id_idx ON public.activity_log (user_id);
CREATE INDEX IF NOT EXISTS activity_log_action_idx ON public.activity_log (action);
CREATE INDEX IF NOT EXISTS activity_log_entity_type_idx ON public.activity_log (entity_type);
CREATE INDEX IF NOT EXISTS activity_log_entity_id_idx ON public.activity_log (entity_id);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
