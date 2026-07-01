-- Beta invite codes (session tokens for HeyMaa_Tester* users).
-- Run in Supabase SQL Editor. Backend uses service role (bypasses RLS).

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  label text,
  notes text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.invite_codes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.invite_codes SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE public.invite_codes SET status = 'active' WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invite_codes_status_check'
  ) THEN
    ALTER TABLE public.invite_codes
      ADD CONSTRAINT invite_codes_status_check
      CHECK (status IN ('active', 'inactive', 'expired'));
  END IF;
END $$;

-- Default beta tester codes (01–30)
INSERT INTO public.invite_codes (code, status, label)
SELECT
  'HeyMaa_Tester' || lpad(i::text, 2, '0'),
  'active',
  'Beta tester ' || lpad(i::text, 2, '0')
FROM generate_series(1, 30) AS i
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Remove broken/overly-permissive policies before recreating (idempotent).
DROP POLICY IF EXISTS "Public read invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Authenticated read invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Anon read invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Authenticated manage invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Anon manage invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Authenticated insert invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Anon insert invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Authenticated update invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Anon update invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Authenticated delete invite codes" ON public.invite_codes;
DROP POLICY IF EXISTS "Anon delete invite codes" ON public.invite_codes;

-- Logged-in Supabase users (admin / authenticated role)
CREATE POLICY "Authenticated read invite codes"
ON public.invite_codes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated insert invite codes"
ON public.invite_codes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update invite codes"
ON public.invite_codes FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated delete invite codes"
ON public.invite_codes FOR DELETE
TO authenticated
USING (true);

-- Anon key (admin backend may use publishable key when service role is unset)
CREATE POLICY "Anon read invite codes"
ON public.invite_codes FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon insert invite codes"
ON public.invite_codes FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon update invite codes"
ON public.invite_codes FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon delete invite codes"
ON public.invite_codes FOR DELETE
TO anon
USING (true);

NOTIFY pgrst, 'reload schema';
