-- Rename offers/news table: admin_messages → offer-news
-- Run in Supabase SQL Editor before deploying backend changes.

ALTER TABLE public.admin_messages RENAME TO "offer-news";

-- Refresh PostgREST schema cache (Supabase picks this up automatically; run if API still 404s)
NOTIFY pgrst, 'reload schema';
