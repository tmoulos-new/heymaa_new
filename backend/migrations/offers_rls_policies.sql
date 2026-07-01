-- Row-level security for offers (announcements / offers feed).
-- Same pattern as promotions_rls_policies.sql.
-- Run in Supabase SQL Editor (after rename_offer_news_to_offers.sql if migrating).

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active offers" ON public.offers;

DROP POLICY IF EXISTS "Authenticated read offers" ON public.offers;
CREATE POLICY "Authenticated read offers"
ON public.offers FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated insert offers" ON public.offers;
CREATE POLICY "Authenticated insert offers"
ON public.offers FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon insert offers" ON public.offers;
CREATE POLICY "Anon insert offers"
ON public.offers FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update offers" ON public.offers;
CREATE POLICY "Authenticated update offers"
ON public.offers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon update offers" ON public.offers;
CREATE POLICY "Anon update offers"
ON public.offers FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete offers" ON public.offers;
CREATE POLICY "Authenticated delete offers"
ON public.offers FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anon delete offers" ON public.offers;
CREATE POLICY "Anon delete offers"
ON public.offers FOR DELETE
TO anon
USING (true);

-- Legacy offer-news policy names (safe to drop after rename)
DROP POLICY IF EXISTS "Public read active offer-news" ON public.offers;
DROP POLICY IF EXISTS "Authenticated read offer-news" ON public.offers;
DROP POLICY IF EXISTS "Authenticated insert offer-news" ON public.offers;
DROP POLICY IF EXISTS "Anon insert offer-news" ON public.offers;
DROP POLICY IF EXISTS "Authenticated update offer-news" ON public.offers;
DROP POLICY IF EXISTS "Anon update offer-news" ON public.offers;
DROP POLICY IF EXISTS "Authenticated delete offer-news" ON public.offers;
DROP POLICY IF EXISTS "Anon delete offer-news" ON public.offers;

NOTIFY pgrst, 'reload schema';
