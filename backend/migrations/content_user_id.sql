-- Track creating admin on offers, regions, invite_codes, promotions.
-- Run in Supabase SQL Editor.

DO $$
DECLARE
  backfill_user uuid := 'f2351a8e-227a-45d1-ae43-a935d4997af5';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = backfill_user) THEN
    RAISE EXCEPTION 'Backfill user % not found in auth.users', backfill_user;
  END IF;
END $$;

-- offers
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.offers
SET user_id = 'f2351a8e-227a-45d1-ae43-a935d4997af5'::uuid
WHERE user_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offers_user_id_fkey'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT offers_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
END $$;
ALTER TABLE public.offers ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS offers_user_id_idx ON public.offers (user_id);

-- regions
ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.regions
SET user_id = 'f2351a8e-227a-45d1-ae43-a935d4997af5'::uuid
WHERE user_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'regions_user_id_fkey'
  ) THEN
    ALTER TABLE public.regions
      ADD CONSTRAINT regions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
END $$;
ALTER TABLE public.regions ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS regions_user_id_idx ON public.regions (user_id);

-- invite_codes
ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.invite_codes
SET user_id = 'f2351a8e-227a-45d1-ae43-a935d4997af5'::uuid
WHERE user_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invite_codes_user_id_fkey'
  ) THEN
    ALTER TABLE public.invite_codes
      ADD CONSTRAINT invite_codes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
END $$;
ALTER TABLE public.invite_codes ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS invite_codes_user_id_idx ON public.invite_codes (user_id);

-- promotions
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.promotions
SET user_id = 'f2351a8e-227a-45d1-ae43-a935d4997af5'::uuid
WHERE user_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_user_id_fkey'
  ) THEN
    ALTER TABLE public.promotions
      ADD CONSTRAINT promotions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
  END IF;
END $$;
ALTER TABLE public.promotions ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS promotions_user_id_idx ON public.promotions (user_id);

NOTIFY pgrst, 'reload schema';
