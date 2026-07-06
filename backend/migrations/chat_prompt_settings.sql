-- Editable chat system instructions. Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.chat_prompt_settings (
  key text PRIMARY KEY,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS chat_prompt_settings_updated_at_idx
  ON public.chat_prompt_settings (updated_at DESC);

ALTER TABLE public.chat_prompt_settings ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
