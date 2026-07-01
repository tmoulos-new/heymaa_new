-- Rename offers/news table: admin_messages → offers
-- Legacy: if you already have "offer-news", run rename_offer_news_to_offers.sql instead.
-- Run in Supabase SQL Editor before deploying backend changes.

ALTER TABLE public.admin_messages RENAME TO offers;

-- Refresh PostgREST schema cache (Supabase picks this up automatically; run if API still 404s)
NOTIFY pgrst, 'reload schema';
