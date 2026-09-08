-- Optional per-call LLM usage log. Admin credit tracking works without this table
-- (running totals live in chat_prompt_settings key = llm_credits).
-- Run in the Supabase SQL editor if you want a queryable history.

CREATE TABLE IF NOT EXISTS public.llm_usage_events (
  id bigint generated ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  model text,
  ok boolean NOT NULL DEFAULT true,
  est_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  predict_time_ms integer,
  error_kind text
);

CREATE INDEX IF NOT EXISTS llm_usage_events_created_at_idx
  ON public.llm_usage_events (created_at DESC);

CREATE INDEX IF NOT EXISTS llm_usage_events_provider_idx
  ON public.llm_usage_events (provider, created_at DESC);

ALTER TABLE public.llm_usage_events ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
