-- In-app support contact threads (mom → admin ↔ reply).
-- Run in the Supabase SQL Editor. Backend uses the service role (bypasses RLS).

CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  invite_token text,
  email text NOT NULL,
  name text,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'billing', 'technical', 'privacy', 'other')),
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending_user', 'pending_admin', 'closed')),
  locale text DEFAULT 'el',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by text
);

CREATE INDEX IF NOT EXISTS support_threads_status_last_idx
  ON public.support_threads (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_threads_user_id_idx
  ON public.support_threads (user_id, last_message_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_threads_email_idx
  ON public.support_threads (lower(email));

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user', 'admin', 'system')),
  sender_admin_id text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_thread_created_idx
  ON public.support_messages (thread_id, created_at ASC);

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
