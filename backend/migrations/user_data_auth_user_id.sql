-- Auth users are keyed by user_id (uuid); beta invite users keep token.
-- Run after users_to_supabase_auth.sql (and alongside profiles_auth_user_id.sql).
--
-- user_data.token was part of the PRIMARY KEY (beta invites). Auth users have no token,
-- so we add id uuid PK and make token nullable.

ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.user_data SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.user_data
  ALTER COLUMN id SET NOT NULL;

-- Replace (token, key) PK with id PK (constraint name may vary)
DO $$
DECLARE
  pk_name text;
BEGIN
  SELECT c.conname INTO pk_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'user_data'
    AND c.contype = 'p';

  IF pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_data DROP CONSTRAINT %I', pk_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'user_data' AND c.conname = 'user_data_pkey'
  ) THEN
    ALTER TABLE public.user_data ADD CONSTRAINT user_data_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE public.user_data
  ALTER COLUMN token DROP NOT NULL;

DROP INDEX IF EXISTS user_data_user_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS user_data_user_id_key_unique
  ON public.user_data(user_id, key)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_data_token_key_unique
  ON public.user_data(token, key)
  WHERE token IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_data_token_or_user_id_check'
  ) THEN
    ALTER TABLE public.user_data
      ADD CONSTRAINT user_data_token_or_user_id_check
      CHECK (token IS NOT NULL OR user_id IS NOT NULL);
  END IF;
END $$;
