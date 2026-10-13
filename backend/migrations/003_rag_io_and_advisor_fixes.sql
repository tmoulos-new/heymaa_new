-- Care Direct: cut RAG disk/IO + fix Supabase advisor findings.
-- Safe to re-run.

SET statement_timeout TO '30min';

-- ---------------------------------------------------------------------------
-- match_chunks: halfvec HNSW path + fixed search_path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(3072),
  match_count integer DEFAULT 6,
  match_threshold double precision DEFAULT 0.22
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT
    ranked.id,
    ranked.source_id,
    ranked.content,
    ranked.metadata,
    ranked.similarity
  FROM (
    SELECT
      rc.id,
      rc.source_id,
      rc.content,
      rc.metadata,
      (1 - (rc.embedding_half <=> query_embedding::halfvec(3072)))::double precision AS similarity
    FROM public.rag_chunks AS rc
    WHERE rc.embedding_half IS NOT NULL
    ORDER BY rc.embedding_half <=> query_embedding::halfvec(3072)
    LIMIT GREATEST(match_count * 8, 40)
  ) AS ranked
  LEFT JOIN public.rag_sources AS s ON s.id = ranked.source_id
  WHERE
    (s.id IS NULL OR COALESCE(s.enabled, true) = true)
    AND (s.id IS NULL OR COALESCE(s.status, 'ready') = 'ready')
    AND ranked.similarity >= match_threshold
  ORDER BY ranked.similarity DESC
  LIMIT GREATEST(match_count, 1);
$$;

REVOKE ALL ON FUNCTION public.match_chunks(vector, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_chunks(vector, integer, double precision)
  TO service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Points helper: fixed search_path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_total_points(p_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(amount), 0)::int
  FROM public.point_transactions
  WHERE user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- is_app_admin: keep for authenticated RLS; block anon RPC probing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS initplan: wrap auth.uid() in (select ...)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users read own row" ON public.users;
CREATE POLICY "Users read own row"
ON public.users FOR SELECT
TO authenticated
USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own row" ON public.users;
CREATE POLICY "Users update own row"
ON public.users FOR UPDATE
TO authenticated
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

-- Collapse duplicate SELECT policies (manage ALL already covers SELECT)
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile"
ON public.profiles FOR ALL
TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users read own data" ON public.user_data;
DROP POLICY IF EXISTS "Users manage own data" ON public.user_data;
CREATE POLICY "Users manage own data"
ON public.user_data FOR ALL
TO authenticated
USING (user_id = (select auth.uid()))
WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Missing FK indexes (advisor)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS activity_log_user_id_idx
  ON public.activity_log (user_id);
CREATE INDEX IF NOT EXISTS chat_prompt_settings_updated_by_idx
  ON public.chat_prompt_settings (updated_by);
CREATE INDEX IF NOT EXISTS support_messages_thread_id_idx
  ON public.support_messages (thread_id);

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Reclaim ~200MB (run separately — VACUUM cannot run inside a transaction):
--   UPDATE public.rag_chunks SET embedding = NULL WHERE embedding IS NOT NULL;
--   VACUUM (ANALYZE) public.rag_chunks;
-- ---------------------------------------------------------------------------
