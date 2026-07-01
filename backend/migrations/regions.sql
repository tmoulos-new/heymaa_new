-- Regions: named markets with associated language codes.
-- Offers and promotions link via offer_regions / promotion_regions (many-to-many).
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  languages text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS regions_name_lower_idx ON public.regions (lower(trim(name)));

CREATE TABLE IF NOT EXISTS public.offer_regions (
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  PRIMARY KEY (offer_id, region_id)
);

CREATE INDEX IF NOT EXISTS offer_regions_region_id_idx ON public.offer_regions (region_id);

CREATE TABLE IF NOT EXISTS public.promotion_regions (
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, region_id)
);

CREATE INDEX IF NOT EXISTS promotion_regions_region_id_idx ON public.promotion_regions (region_id);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_regions ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: backend service role only.

-- Optional starter regions (safe to re-run).
INSERT INTO public.regions (name, languages, active)
SELECT v.name, v.languages, v.active
FROM (
  VALUES
    ('Greece & Cyprus', ARRAY['el', 'en']::text[], true),
    ('Global (English)', ARRAY['en']::text[], true)
) AS v(name, languages, active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.regions r WHERE lower(trim(r.name)) = lower(trim(v.name))
);

NOTIFY pgrst, 'reload schema';
