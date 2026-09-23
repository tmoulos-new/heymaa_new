-- Chat quality loop: turn log, user thumbs, auto/admin reviews.
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.chat_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  user_id uuid,
  user_message text NOT NULL DEFAULT '',
  assistant_reply text NOT NULL DEFAULT '',
  lang text,
  provider text,
  needs_rag boolean,
  request_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_turns_created_at_idx
  ON public.chat_turns (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_turns_user_id_idx
  ON public.chat_turns (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  user_id uuid,
  vote text NOT NULL CHECK (vote IN ('up', 'down')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_feedback_created_at_idx
  ON public.chat_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_feedback_vote_idx
  ON public.chat_feedback (vote, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_feedback_message_id_idx
  ON public.chat_feedback (message_id);

CREATE TABLE IF NOT EXISTS public.chat_quality_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  tags text[] NOT NULL DEFAULT '{}',
  summary text,
  proposal text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'fixed', 'dismissed')),
  source text NOT NULL DEFAULT 'auto'
    CHECK (source IN ('auto', 'rules', 'admin')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_quality_reviews_created_at_idx
  ON public.chat_quality_reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_quality_reviews_status_idx
  ON public.chat_quality_reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_quality_reviews_message_id_idx
  ON public.chat_quality_reviews (message_id);
CREATE INDEX IF NOT EXISTS chat_quality_reviews_score_idx
  ON public.chat_quality_reviews (score);

ALTER TABLE public.chat_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_quality_reviews ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
