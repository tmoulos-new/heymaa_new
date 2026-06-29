-- Row-level security for offer-news (announcements / offers feed).
-- Run in Supabase SQL Editor.

ALTER TABLE public."offer-news" ENABLE ROW LEVEL SECURITY;

-- App feed: anyone can read active rows
DROP POLICY IF EXISTS "Public read active offer-news" ON public."offer-news";
CREATE POLICY "Public read active offer-news"
ON public."offer-news" FOR SELECT
TO public
USING (active = true);

-- Logged-in Supabase users can insert
DROP POLICY IF EXISTS "Authenticated insert offer-news" ON public."offer-news";
CREATE POLICY "Authenticated insert offer-news"
ON public."offer-news" FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admin backend uses anon/publishable key unless SUPABASE_SERVICE_KEY is service_role
DROP POLICY IF EXISTS "Anon insert offer-news" ON public."offer-news";
CREATE POLICY "Anon insert offer-news"
ON public."offer-news" FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update offer-news" ON public."offer-news";
CREATE POLICY "Authenticated update offer-news"
ON public."offer-news" FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon update offer-news" ON public."offer-news";
CREATE POLICY "Anon update offer-news"
ON public."offer-news" FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete offer-news" ON public."offer-news";
CREATE POLICY "Authenticated delete offer-news"
ON public."offer-news" FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Anon delete offer-news" ON public."offer-news";
CREATE POLICY "Anon delete offer-news"
ON public."offer-news" FOR DELETE
TO anon
USING (true);

-- Admin list shows all active rows (same as public read for now)
DROP POLICY IF EXISTS "Authenticated read offer-news" ON public."offer-news";
CREATE POLICY "Authenticated read offer-news"
ON public."offer-news" FOR SELECT
TO authenticated
USING (true);

NOTIFY pgrst, 'reload schema';
