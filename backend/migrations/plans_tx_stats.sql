-- Persist LLM transaction stats on plans.
-- Run in the Supabase SQL editor (after plans_and_users_plan_id.sql + llm_transactions.sql).

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS tx_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS tx_cost_usd numeric(14, 6) NOT NULL DEFAULT 0;

-- Backfill from llm_transactions joined to users.plan_id
UPDATE public.plans
SET tx_count = 0,
    tx_cost_usd = 0;

UPDATE public.plans p
SET
  tx_count = sub.cnt,
  tx_cost_usd = sub.cost,
  updated_at = now()
FROM (
  SELECT
    COALESCE(NULLIF(btrim(u.plan_id), ''), 'trial') AS plan_id,
    COUNT(*)::integer AS cnt,
    ROUND(COALESCE(SUM(t.cost_usd), 0)::numeric, 6) AS cost
  FROM public.llm_transactions t
  INNER JOIN public.users u ON u.id = t.user_id
  WHERE t.user_id IS NOT NULL
  GROUP BY 1
) sub
WHERE p.id = sub.plan_id;

NOTIFY pgrst, 'reload schema';
