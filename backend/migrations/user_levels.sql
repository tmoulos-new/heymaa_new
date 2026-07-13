-- User levels and points. Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.levels (
  id smallint PRIMARY KEY,
  sort_order smallint NOT NULL UNIQUE,
  min_points int NOT NULL CHECK (min_points >= 0),
  name_el text NOT NULL,
  name_en text NOT NULL
);

INSERT INTO public.levels (id, sort_order, min_points, name_el, name_en) VALUES
  (1, 1, 0,    'Νέα Μαμά',         'New Mom'),
  (2, 2, 250,  'Ενεργή Μαμά',      'Active Mom'),
  (3, 3, 750,  'Αφοσιωμένη Μαμά',  'Dedicated Mom'),
  (4, 4, 1500, 'Super Μαμά',       'Super Mom'),
  (5, 5, 2500, 'HeyMaa Champion',  'HeyMaa Champion')
ON CONFLICT (id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  min_points = EXCLUDED.min_points,
  name_el = EXCLUDED.name_el,
  name_en = EXCLUDED.name_en;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS level_id smallint NOT NULL DEFAULT 1 REFERENCES public.levels(id);

CREATE TABLE IF NOT EXISTS public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount int NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  action text,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS point_transactions_user_id_idx
  ON public.point_transactions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.user_total_points(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)::int
  FROM public.point_transactions
  WHERE user_id = p_user_id;
$$;

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
