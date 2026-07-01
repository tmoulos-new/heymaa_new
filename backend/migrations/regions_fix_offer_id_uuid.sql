-- Fix offer_regions.offer_id type when an earlier migration used bigint.
-- Run in Supabase SQL Editor if regions.sql failed with:
--   foreign key constraint "offer_regions_offer_id_fkey" cannot be implemented
--   Key columns "offer_id" and "id" are of incompatible types: bigint and uuid.

DROP TABLE IF EXISTS public.offer_regions;

CREATE TABLE public.offer_regions (
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, region_id)
);

CREATE INDEX IF NOT EXISTS offer_regions_region_id_idx ON public.offer_regions (region_id);

ALTER TABLE public.offer_regions ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
