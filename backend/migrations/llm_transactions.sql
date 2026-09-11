-- Per-API-call LLM cost ledger. One row per provider invocation (chat, embed, etc.).
-- Aggregates for the admin Usage card still live in chat_prompt_settings (key = llm_credits).
-- Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.llm_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  purpose text NOT NULL DEFAULT 'chat',
  provider text NOT NULL,
  model text,
  ok boolean NOT NULL DEFAULT true,
  cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  latency_ms integer,
  predict_time_ms integer,
  input_chars integer,
  output_chars integer,
  user_id uuid,
  request_id text,
  error_kind text,
  error_msg text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS llm_transactions_created_at_idx
  ON public.llm_transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS llm_transactions_provider_idx
  ON public.llm_transactions (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS llm_transactions_purpose_idx
  ON public.llm_transactions (purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS llm_transactions_user_id_idx
  ON public.llm_transactions (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS llm_transactions_request_id_idx
  ON public.llm_transactions (request_id)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.llm_transactions ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
