-- Row-level security for promotions (targeted/sponsored content).
-- Same pattern as offers_rls_policies.sql.
-- Run in Supabase SQL Editor.

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active promotions" ON public.promotions;

DROP POLICY IF EXISTS "Authenticated read promotions" ON public.promotions;
CREATE POLICY "Authenticated read promotions"
ON public.promotions FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated insert promotions" ON public.promotions;
CREATE POLICY "Authenticated insert promotions"
ON public.promotions FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon insert promotions" ON public.promotions;
CREATE POLICY "Anon insert promotions"
ON public.promotions FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update promotions" ON public.promotions;
CREATE POLICY "Authenticated update promotions"
ON public.promotions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon update promotions" ON public.promotions;
CREATE POLICY "Anon update promotions"
ON public.promotions FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete promotions" ON public.promotions;
CREATE POLICY "Authenticated delete promotions"
ON public.promotions FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anon delete promotions" ON public.promotions;
CREATE POLICY "Anon delete promotions"
ON public.promotions FOR DELETE
TO anon
USING (true);

NOTIFY pgrst, 'reload schema';
