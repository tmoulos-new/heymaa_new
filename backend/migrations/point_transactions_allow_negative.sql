-- Allow debit (negative) point transactions, e.g. unchecking a milestone.
-- Run in Supabase SQL Editor.

ALTER TABLE public.point_transactions
  DROP CONSTRAINT IF EXISTS point_transactions_amount_check;

ALTER TABLE public.point_transactions
  ADD CONSTRAINT point_transactions_amount_check CHECK (amount <> 0);

NOTIFY pgrst, 'reload schema';
