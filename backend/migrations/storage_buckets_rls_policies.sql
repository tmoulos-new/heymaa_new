-- RLS for offers / promotions storage buckets (matches offers table policies).
-- Run in Supabase SQL Editor after add_offer_promotion_images.sql.

INSERT INTO storage.buckets (id, name, public)
VALUES ('offers', 'offers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('promotions', 'promotions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── offers bucket ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public read offers images" ON storage.objects;
CREATE POLICY "Public read offers images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'offers');

DROP POLICY IF EXISTS "Authenticated read offers images" ON storage.objects;
CREATE POLICY "Authenticated read offers images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'offers');

DROP POLICY IF EXISTS "Authenticated insert offers images" ON storage.objects;
CREATE POLICY "Authenticated insert offers images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'offers');

DROP POLICY IF EXISTS "Anon insert offers images" ON storage.objects;
CREATE POLICY "Anon insert offers images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'offers');

DROP POLICY IF EXISTS "Authenticated update offers images" ON storage.objects;
CREATE POLICY "Authenticated update offers images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'offers')
WITH CHECK (bucket_id = 'offers');

DROP POLICY IF EXISTS "Anon update offers images" ON storage.objects;
CREATE POLICY "Anon update offers images"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'offers')
WITH CHECK (bucket_id = 'offers');

DROP POLICY IF EXISTS "Authenticated delete offers images" ON storage.objects;
CREATE POLICY "Authenticated delete offers images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'offers');

DROP POLICY IF EXISTS "Anon delete offers images" ON storage.objects;
CREATE POLICY "Anon delete offers images"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'offers');

-- ── promotions bucket ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public read promotions images" ON storage.objects;
CREATE POLICY "Public read promotions images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Authenticated read promotions images" ON storage.objects;
CREATE POLICY "Authenticated read promotions images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Authenticated insert promotions images" ON storage.objects;
CREATE POLICY "Authenticated insert promotions images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Anon insert promotions images" ON storage.objects;
CREATE POLICY "Anon insert promotions images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Authenticated update promotions images" ON storage.objects;
CREATE POLICY "Authenticated update promotions images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'promotions')
WITH CHECK (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Anon update promotions images" ON storage.objects;
CREATE POLICY "Anon update promotions images"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'promotions')
WITH CHECK (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Authenticated delete promotions images" ON storage.objects;
CREATE POLICY "Authenticated delete promotions images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'promotions');

DROP POLICY IF EXISTS "Anon delete promotions images" ON storage.objects;
CREATE POLICY "Anon delete promotions images"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'promotions');

NOTIFY pgrst, 'reload schema';
