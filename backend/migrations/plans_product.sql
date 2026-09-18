-- ERP product SKUs on plans (SoftOne codes used by getCompletedOrders.product).
-- Run in the Supabase SQL editor after plans_and_users_plan_id.sql.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS product text;

UPDATE public.plans
SET
  product = CASE id
    WHEN 'starter' THEN 'HM-STARTER'
    WHEN 'premium' THEN 'HM-PREMIUM'
    WHEN 'annual' THEN 'HM-APREMIUM'
    ELSE product
  END,
  updated_at = now()
WHERE id IN ('starter', 'premium', 'annual')
  AND (product IS NULL OR btrim(product) = '');

NOTIFY pgrst, 'reload schema';
