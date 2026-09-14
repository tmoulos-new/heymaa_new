-- Level-up gifts (free plan days). Run in Supabase SQL Editor.
-- Admin UI: /admin/points  (Levels card)

ALTER TABLE public.levels
  ADD COLUMN IF NOT EXISTS reward_plan_slot text;

ALTER TABLE public.levels
  ADD COLUMN IF NOT EXISTS reward_days int;

ALTER TABLE public.levels
  DROP CONSTRAINT IF EXISTS levels_reward_plan_slot_check;

ALTER TABLE public.levels
  ADD CONSTRAINT levels_reward_plan_slot_check
  CHECK (reward_plan_slot IS NULL OR reward_plan_slot IN ('starter', 'premium'));

ALTER TABLE public.levels
  DROP CONSTRAINT IF EXISTS levels_reward_days_check;

ALTER TABLE public.levels
  ADD CONSTRAINT levels_reward_days_check
  CHECK (reward_days IS NULL OR reward_days > 0);

UPDATE public.levels SET reward_plan_slot = 'starter', reward_days = 3 WHERE id = 2 AND reward_plan_slot IS NULL;
UPDATE public.levels SET reward_plan_slot = 'starter', reward_days = 7 WHERE id = 3 AND reward_plan_slot IS NULL;
UPDATE public.levels SET reward_plan_slot = 'premium', reward_days = 3 WHERE id = 4 AND reward_plan_slot IS NULL;
UPDATE public.levels SET reward_plan_slot = 'premium', reward_days = 7 WHERE id = 5 AND reward_plan_slot IS NULL;

NOTIFY pgrst, 'reload schema';
