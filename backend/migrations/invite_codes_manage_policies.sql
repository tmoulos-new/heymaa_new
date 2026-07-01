-- Allow authenticated users and anon (publishable key) to manage invite_codes.
-- Same pattern as promotions_rls_policies.sql / offers_rls_policies.sql.
-- Run in Supabase SQL Editor if you already applied invite_codes_rls_policies.sql without these policies.

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read invite codes" ON public.invite_codes;
CREATE POLICY "Authenticated read invite codes"
ON public.invite_codes FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated insert invite codes" ON public.invite_codes;
CREATE POLICY "Authenticated insert invite codes"
ON public.invite_codes FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update invite codes" ON public.invite_codes;
CREATE POLICY "Authenticated update invite codes"
ON public.invite_codes FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete invite codes" ON public.invite_codes;
CREATE POLICY "Authenticated delete invite codes"
ON public.invite_codes FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anon read invite codes" ON public.invite_codes;
CREATE POLICY "Anon read invite codes"
ON public.invite_codes FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon insert invite codes" ON public.invite_codes;
CREATE POLICY "Anon insert invite codes"
ON public.invite_codes FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon update invite codes" ON public.invite_codes;
CREATE POLICY "Anon update invite codes"
ON public.invite_codes FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon delete invite codes" ON public.invite_codes;
CREATE POLICY "Anon delete invite codes"
ON public.invite_codes FOR DELETE
TO anon
USING (true);

NOTIFY pgrst, 'reload schema';
