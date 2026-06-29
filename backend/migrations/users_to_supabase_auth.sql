-- Supabase Auth setup for HeyMaa (new users only — no data backfill).
-- Run once in the Supabase SQL Editor before deploying the updated backend.

-- Legacy column: passwords are in auth.users; app rows may omit password_hash (invites, register).
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- Link app tables to auth.users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_data ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS user_data_user_id_idx ON public.user_data(user_id);

-- public.users.id must match auth.users.id (created together at registration).
-- Requires users_auth_orphan_cleanup.sql first if legacy rows exist without auth.users.
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.users u
  LEFT JOIN auth.users a ON a.id = u.id
  WHERE a.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add users_id_fkey: % public.users row(s) have no auth.users match. Run users_auth_orphan_cleanup.sql first (or backfill auth users).',
      orphan_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_id_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- RLS for authenticated role (backend service role bypasses; useful if clients use Supabase JS directly)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own row" ON public.users;
CREATE POLICY "Users read own row"
ON public.users FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Users update own row" ON public.users;
CREATE POLICY "Users update own row"
ON public.users FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile"
ON public.profiles FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own data" ON public.user_data;
CREATE POLICY "Users read own data"
ON public.user_data FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own data" ON public.user_data;
CREATE POLICY "Users manage own data"
ON public.user_data FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
