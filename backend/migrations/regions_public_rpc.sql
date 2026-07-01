-- Extend public RPCs to filter offers/promotions by region languages.
-- Empty region links = visible in all regions (backward compatible).
-- Run in Supabase SQL Editor after regions.sql.

CREATE OR REPLACE FUNCTION public.get_active_offers(p_lang text DEFAULT NULL)
RETURNS SETOF public.offers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.*
  FROM public.offers o
  WHERE o.active = true
    AND (
      o.expires_at IS NULL
      OR o.expires_at::date >= CURRENT_DATE
    )
    AND (
      p_lang IS NULL
      OR COALESCE(o.lang, 'all') = 'all'
      OR o.lang = p_lang
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.offer_regions orr WHERE orr.offer_id = o.id
      )
      OR p_lang IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.offer_regions orr
        JOIN public.regions r ON r.id = orr.region_id AND r.active = true
        WHERE orr.offer_id = o.id
          AND p_lang = ANY (r.languages)
      )
    )
  ORDER BY o.id DESC;
$$;

DROP FUNCTION IF EXISTS public.get_active_promotions();

CREATE OR REPLACE FUNCTION public.get_active_promotions(p_lang text DEFAULT NULL)
RETURNS SETOF public.promotions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.promotions p
  WHERE p.active = true
    AND (
      p.expires_at IS NULL
      OR p.expires_at::date >= CURRENT_DATE
    )
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.promotion_regions pr WHERE pr.promotion_id = p.id
      )
      OR p_lang IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.promotion_regions pr
        JOIN public.regions r ON r.id = pr.region_id AND r.active = true
        WHERE pr.promotion_id = p.id
          AND p_lang = ANY (r.languages)
      )
    )
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_active_offers(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_promotions(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_active_offers(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_promotions(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
