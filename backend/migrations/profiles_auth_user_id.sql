-- Auth users are keyed by user_id (uuid); beta invite users keep token.
-- Run after users_to_supabase_auth.sql.
--
-- profiles.token was the PRIMARY KEY (beta invites). Auth users have no token,
-- so we add id uuid PK and make token nullable.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- New surrogate primary key
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.profiles SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN id SET NOT NULL;

-- Replace token PK with id PK (constraint name may vary)
DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT c.conname INTO pk_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'profiles'
    AND c.contype = 'p';

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', pk_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'profiles' AND c.conname = 'profiles_pkey'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Beta rows keep token; auth rows use user_id only
ALTER TABLE public.profiles
  ALTER COLUMN token DROP NOT NULL;

DROP INDEX IF EXISTS profiles_user_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique
  ON public.profiles(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_token_unique
  ON public.profiles(token)
  WHERE token IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_token_or_user_id_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_token_or_user_id_check
      CHECK (token IS NOT NULL OR user_id IS NOT NULL);
  END IF;
END $$;
