-- RLS for rag_sources / rag_chunks.
-- Admins (users.role = 'admin') can read/write; others have no direct access.
-- Backend service_role bypasses RLS; chat retrieval via match_chunks stays unaffected.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

-- ── rag_sources ──────────────────────────────────────────────
ALTER TABLE public.rag_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin select rag_sources" ON public.rag_sources;
CREATE POLICY "Admin select rag_sources"
ON public.rag_sources FOR SELECT
TO authenticated
USING (public.is_app_admin());

DROP POLICY IF EXISTS "Admin insert rag_sources" ON public.rag_sources;
CREATE POLICY "Admin insert rag_sources"
ON public.rag_sources FOR INSERT
TO authenticated
WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Admin update rag_sources" ON public.rag_sources;
CREATE POLICY "Admin update rag_sources"
ON public.rag_sources FOR UPDATE
TO authenticated
USING (public.is_app_admin())
WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Admin delete rag_sources" ON public.rag_sources;
CREATE POLICY "Admin delete rag_sources"
ON public.rag_sources FOR DELETE
TO authenticated
USING (public.is_app_admin());

-- ── rag_chunks ───────────────────────────────────────────────
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin select rag_chunks" ON public.rag_chunks;
CREATE POLICY "Admin select rag_chunks"
ON public.rag_chunks FOR SELECT
TO authenticated
USING (public.is_app_admin());

DROP POLICY IF EXISTS "Admin insert rag_chunks" ON public.rag_chunks;
CREATE POLICY "Admin insert rag_chunks"
ON public.rag_chunks FOR INSERT
TO authenticated
WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Admin update rag_chunks" ON public.rag_chunks;
CREATE POLICY "Admin update rag_chunks"
ON public.rag_chunks FOR UPDATE
TO authenticated
USING (public.is_app_admin())
WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Admin delete rag_chunks" ON public.rag_chunks;
CREATE POLICY "Admin delete rag_chunks"
ON public.rag_chunks FOR DELETE
TO authenticated
USING (public.is_app_admin());

NOTIFY pgrst, 'reload schema';
