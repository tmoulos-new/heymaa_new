-- Paid subscription period end (monthly / annual billing cycle)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;

CREATE INDEX IF NOT EXISTS users_subscription_ends_at_idx
  ON public.users (subscription_ends_at)
  WHERE subscription_ends_at IS NOT NULL;
