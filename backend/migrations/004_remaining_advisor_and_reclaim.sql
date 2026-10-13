-- Remaining Care Direct fixes (applied 2026-10-13).
-- Admin RLS for former empty-policy tables + move vector to extensions.
-- Disk reclaim: DROP embedding column (done). VACUUM FULL timed out in SQL Editor —
-- run from a direct DB connection when Disk IO budget is healthy:
--   VACUUM (FULL, ANALYZE) public.rag_chunks;

SET statement_timeout TO '30min';

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'activity_log','admin_email_campaigns','app_notification_recipients','app_notifications',
    'chat_feedback','chat_prompt_settings','chat_quality_reviews','chat_turns','completed_orders',
    'email_events','email_sends','gift_claims','gift_codes','invite_codes','knowledge_sources',
    'levels','llm_transactions','llm_usage_events','offer_regions','plan_grants','plans',
    'point_rules','point_settings','point_transactions','promotion_regions','push_subscriptions',
    'rag_seed_jobs','regions','support_messages','support_threads','user_activity_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admin all ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin())',
      'Admin all ' || t, t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Public read active regions" ON public.regions;
CREATE POLICY "Public read active regions"
ON public.regions FOR SELECT TO anon, authenticated USING (active = true);

DROP POLICY IF EXISTS "Public read plans" ON public.plans;
CREATE POLICY "Public read plans"
ON public.plans FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read levels" ON public.levels;
CREATE POLICY "Public read levels"
ON public.levels FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read point_rules" ON public.point_rules;
CREATE POLICY "Public read point_rules"
ON public.point_rules FOR SELECT TO anon, authenticated USING (true);

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER DATABASE postgres SET search_path TO "$user", public, extensions;

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(3072),
  match_count integer DEFAULT 6,
  match_threshold double precision DEFAULT 0.22
)
RETURNS TABLE (
  id uuid, source_id uuid, content text, metadata jsonb, similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT ranked.id, ranked.source_id, ranked.content, ranked.metadata, ranked.similarity
  FROM (
    SELECT rc.id, rc.source_id, rc.content, rc.metadata,
      (1 - (rc.embedding_half <=> query_embedding::halfvec(3072)))::double precision AS similarity
    FROM public.rag_chunks AS rc
    WHERE rc.embedding_half IS NOT NULL
    ORDER BY rc.embedding_half <=> query_embedding::halfvec(3072)
    LIMIT GREATEST(match_count * 8, 40)
  ) AS ranked
  LEFT JOIN public.rag_sources AS s ON s.id = ranked.source_id
  WHERE (s.id IS NULL OR COALESCE(s.enabled, true) = true)
    AND (s.id IS NULL OR COALESCE(s.status, 'ready') = 'ready')
    AND ranked.similarity >= match_threshold
  ORDER BY ranked.similarity DESC
  LIMIT GREATEST(match_count, 1);
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, integer, double precision)
  TO service_role, authenticated, anon, postgres;

ALTER TABLE public.rag_chunks DROP COLUMN IF EXISTS embedding;

NOTIFY pgrst, 'reload schema';
