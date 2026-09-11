-- Per-plan LLM quotas (limits). Usage remains on plans.tx_count / tx_cost_usd
-- and per-user from llm_transactions. Remaining = limit - user usage.
-- Run in the Supabase SQL editor.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS tx_limit integer;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS tx_cost_limit_usd numeric(14, 6);

UPDATE public.plans
SET
  tx_limit = CASE id
    WHEN 'trial' THEN 100
    WHEN 'starter' THEN 500
    WHEN 'premium' THEN 2000
    WHEN 'annual' THEN 5000
    ELSE tx_limit
  END,
  tx_cost_limit_usd = CASE id
    WHEN 'trial' THEN 1.0000
    WHEN 'starter' THEN 5.0000
    WHEN 'premium' THEN 20.0000
    WHEN 'annual' THEN 50.0000
    ELSE tx_cost_limit_usd
  END,
  updated_at = now()
WHERE tx_limit IS NULL
   OR tx_cost_limit_usd IS NULL;

NOTIFY pgrst, 'reload schema';
