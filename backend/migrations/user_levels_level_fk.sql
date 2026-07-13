-- Replace users.points with users.level_id FK.
-- Run in Supabase SQL Editor if you already applied an earlier user_levels.sql with a points column.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS level_id smallint REFERENCES public.levels(id);

UPDATE public.users u
SET level_id = sub.level_id
FROM (
  SELECT u2.id AS user_id,
         (
           SELECT l.id
           FROM public.levels l
           WHERE l.min_points <= COALESCE(u2.points, 0)
           ORDER BY l.min_points DESC
           LIMIT 1
         ) AS level_id
  FROM public.users u2
) sub
WHERE u.id = sub.user_id
  AND u.level_id IS NULL;

UPDATE public.users SET level_id = 1 WHERE level_id IS NULL;

ALTER TABLE public.users
  ALTER COLUMN level_id SET DEFAULT 1,
  ALTER COLUMN level_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_level_id_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_level_id_fkey
      FOREIGN KEY (level_id) REFERENCES public.levels(id);
  END IF;
END $$;

ALTER TABLE public.users DROP COLUMN IF EXISTS points;

CREATE OR REPLACE FUNCTION public.user_total_points(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)::int
  FROM public.point_transactions
  WHERE user_id = p_user_id;
$$;

NOTIFY pgrst, 'reload schema';
