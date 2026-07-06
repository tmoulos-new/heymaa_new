-- RLS for regions + junction tables (offer_regions, promotion_regions).
-- Run in Supabase SQL Editor after regions.sql.
-- Backend uses service role (bypasses RLS); anon/authenticated policies support publishable-key fallback.

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_regions ENABLE ROW LEVEL SECURITY;

-- regions
DROP POLICY IF EXISTS "Authenticated read regions" ON public.regions;
DROP POLICY IF EXISTS "Authenticated insert regions" ON public.regions;
DROP POLICY IF EXISTS "Authenticated update regions" ON public.regions;
DROP POLICY IF EXISTS "Authenticated delete regions" ON public.regions;
DROP POLICY IF EXISTS "Anon read regions" ON public.regions;
DROP POLICY IF EXISTS "Anon insert regions" ON public.regions;
DROP POLICY IF EXISTS "Anon update regions" ON public.regions;
DROP POLICY IF EXISTS "Anon delete regions" ON public.regions;

CREATE POLICY "Authenticated read regions"
ON public.regions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated insert regions"
ON public.regions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update regions"
ON public.regions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated delete regions"
ON public.regions FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Anon read regions"
ON public.regions FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon insert regions"
ON public.regions FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon update regions"
ON public.regions FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon delete regions"
ON public.regions FOR DELETE
TO anon
USING (true);

-- offer_regions
DROP POLICY IF EXISTS "Authenticated read offer_regions" ON public.offer_regions;
DROP POLICY IF EXISTS "Authenticated insert offer_regions" ON public.offer_regions;
DROP POLICY IF EXISTS "Authenticated update offer_regions" ON public.offer_regions;
DROP POLICY IF EXISTS "Authenticated delete offer_regions" ON public.offer_regions;
DROP POLICY IF EXISTS "Anon read offer_regions" ON public.offer_regions;
DROP POLICY IF EXISTS "Anon insert offer_regions" ON public.offer_regions;
DROP POLICY IF EXISTS "Anon update offer_regions" ON public.offer_regions;
DROP POLICY IF EXISTS "Anon delete offer_regions" ON public.offer_regions;

CREATE POLICY "Authenticated read offer_regions"
ON public.offer_regions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated insert offer_regions"
ON public.offer_regions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update offer_regions"
ON public.offer_regions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated delete offer_regions"
ON public.offer_regions FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Anon read offer_regions"
ON public.offer_regions FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon insert offer_regions"
ON public.offer_regions FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon update offer_regions"
ON public.offer_regions FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon delete offer_regions"
ON public.offer_regions FOR DELETE
TO anon
USING (true);

-- promotion_regions
DROP POLICY IF EXISTS "Authenticated read promotion_regions" ON public.promotion_regions;
DROP POLICY IF EXISTS "Authenticated insert promotion_regions" ON public.promotion_regions;
DROP POLICY IF EXISTS "Authenticated update promotion_regions" ON public.promotion_regions;
DROP POLICY IF EXISTS "Authenticated delete promotion_regions" ON public.promotion_regions;
DROP POLICY IF EXISTS "Anon read promotion_regions" ON public.promotion_regions;
DROP POLICY IF EXISTS "Anon insert promotion_regions" ON public.promotion_regions;
DROP POLICY IF EXISTS "Anon update promotion_regions" ON public.promotion_regions;
DROP POLICY IF EXISTS "Anon delete promotion_regions" ON public.promotion_regions;

CREATE POLICY "Authenticated read promotion_regions"
ON public.promotion_regions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated insert promotion_regions"
ON public.promotion_regions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated update promotion_regions"
ON public.promotion_regions FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated delete promotion_regions"
ON public.promotion_regions FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Anon read promotion_regions"
ON public.promotion_regions FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon insert promotion_regions"
ON public.promotion_regions FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon update promotion_regions"
ON public.promotion_regions FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon delete promotion_regions"
ON public.promotion_regions FOR DELETE
TO anon
USING (true);

NOTIFY pgrst, 'reload schema';
