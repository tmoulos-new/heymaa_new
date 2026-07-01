-- Image storage for offers and promotions.
-- Run in Supabase SQL Editor.

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS image_key text;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS image_key text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('offers', 'offers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('promotions', 'promotions', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for offer/promo images (uploads go through backend service role).
DROP POLICY IF EXISTS "Public read offers images" ON storage.objects;
CREATE POLICY "Public read offers images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'offers');

DROP POLICY IF EXISTS "Public read promotions images" ON storage.objects;
CREATE POLICY "Public read promotions images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'promotions');

NOTIFY pgrst, 'reload schema';
