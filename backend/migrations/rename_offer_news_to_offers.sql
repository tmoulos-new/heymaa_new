-- Rename offer-news → offers (storage bucket already uses "offers").
-- Run in Supabase SQL Editor if the table is still named "offer-news".

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'offer-news'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'offers'
  ) THEN
    ALTER TABLE public."offer-news" RENAME TO offers;
  END IF;
END $$;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Drop legacy policy names from offer-news era
DROP POLICY IF EXISTS "Public read active offer-news" ON public.offers;
DROP POLICY IF EXISTS "Authenticated insert offer-news" ON public.offers;
DROP POLICY IF EXISTS "Anon insert offer-news" ON public.offers;
DROP POLICY IF EXISTS "Authenticated update offer-news" ON public.offers;
DROP POLICY IF EXISTS "Anon update offer-news" ON public.offers;
DROP POLICY IF EXISTS "Authenticated delete offer-news" ON public.offers;
DROP POLICY IF EXISTS "Anon delete offer-news" ON public.offers;
DROP POLICY IF EXISTS "Authenticated read offer-news" ON public.offers;

NOTIFY pgrst, 'reload schema';
