-- Normalize trial users to a 14-day period from signup (fixes legacy 3-day trials).
-- Safe to run multiple times.

UPDATE public.users
SET trial_ends_at = created_at + interval '14 days'
WHERE subscription_status = 'trial'
  AND created_at IS NOT NULL
  AND (
    trial_ends_at IS NULL
    OR trial_ends_at < created_at + interval '10 days'
  );
