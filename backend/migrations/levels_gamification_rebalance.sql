-- Rebalance level thresholds (gamification points package).
-- Run in Supabase SQL Editor after deploy.

UPDATE public.levels SET min_points = 400  WHERE id = 2;
UPDATE public.levels SET min_points = 1000 WHERE id = 3;
UPDATE public.levels SET min_points = 2000 WHERE id = 4;
UPDATE public.levels SET min_points = 3500 WHERE id = 5;

NOTIFY pgrst, 'reload schema';
