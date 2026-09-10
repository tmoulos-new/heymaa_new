-- Completed Viva subscription payments for ERP invoice sync.
-- Run in the Supabase SQL Editor. Backend uses service role (bypasses RLS).

CREATE TABLE IF NOT EXISTS public.completed_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL UNIQUE,
  order_code text,
  status text NOT NULL DEFAULT 'completed',
  status_id text,
  completed_at timestamptz NOT NULL,
  email text,
  full_name text,
  phone text,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  currency_code integer DEFAULT 978,
  plan text,
  product text,
  customer_trns text,
  merchant_trns text,
  user_id uuid,
  address_street text,
  address_number text,
  address_zip text,
  address_city text,
  address_country text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS completed_orders_completed_at_idx
  ON public.completed_orders (completed_at ASC);

CREATE INDEX IF NOT EXISTS completed_orders_email_idx
  ON public.completed_orders (email);

ALTER TABLE public.completed_orders ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
