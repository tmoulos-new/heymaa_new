-- Remaining greenfield objects after 000_bootstrap_core.sql.
-- Includes extras + RAG baseline + public RPCs. Safe to re-run.

-- ── extras (chat / email / activity / admin) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_prompt_settings (
  key text PRIMARY KEY,
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS chat_prompt_settings_updated_at_idx
  ON public.chat_prompt_settings (updated_at DESC);
ALTER TABLE public.chat_prompt_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  token text,
  action text NOT NULL,
  path text NOT NULL,
  label text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_activity_log_actor_check CHECK (user_id IS NOT NULL OR token IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS user_activity_log_created_at_idx ON public.user_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_user_id_idx ON public.user_activity_log (user_id);
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id text UNIQUE,
  kind text NOT NULL DEFAULT 'transactional',
  campaign_id uuid,
  user_id uuid,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_sends_created_at_idx ON public.email_sends (created_at DESC);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id text NOT NULL,
  event_type text NOT NULL,
  to_email text,
  link text,
  user_agent text,
  ip text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_events_resend_id_idx ON public.email_events (resend_id, event_type);
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  url text,
  audience text NOT NULL DEFAULT 'selected',
  audience_label text,
  status text NOT NULL DEFAULT 'sending',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  recipient_count int NOT NULL DEFAULT 0,
  delivered int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  last_error text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.admin_email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.llm_usage_events (
  id bigint generated ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL,
  model text,
  ok boolean NOT NULL DEFAULT true,
  est_cost_usd numeric(12, 6) NOT NULL DEFAULT 0,
  predict_time_ms integer,
  error_kind text
);
ALTER TABLE public.llm_usage_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  user_id uuid,
  user_message text NOT NULL DEFAULT '',
  assistant_reply text NOT NULL DEFAULT '',
  lang text,
  provider text,
  needs_rag boolean,
  request_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_turns_created_at_idx ON public.chat_turns (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_turns_user_id_idx ON public.chat_turns (user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  user_id uuid,
  vote text NOT NULL CHECK (vote IN ('up', 'down')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_feedback_created_at_idx ON public.chat_feedback (created_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_quality_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  tags text[] NOT NULL DEFAULT '{}',
  summary text,
  proposal text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'fixed', 'dismissed')),
  source text NOT NULL DEFAULT 'auto'
    CHECK (source IN ('auto', 'rules', 'admin')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_quality_reviews_created_at_idx
  ON public.chat_quality_reviews (created_at DESC);
ALTER TABLE public.chat_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_quality_reviews ENABLE ROW LEVEL SECURITY;

-- ── RAG baseline ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.rag_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  source_type text,
  origin text,
  source_key text,
  language text,
  source_url text,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'processing',
  chunk_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_sources_source_url_unique
  ON public.rag_sources (source_url)
  WHERE source_url IS NOT NULL AND source_url <> '';
CREATE INDEX IF NOT EXISTS idx_rag_sources_source_key
  ON public.rag_sources (source_key) WHERE source_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_sources_origin
  ON public.rag_sources (origin) WHERE origin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_sources_enabled_ready
  ON public.rag_sources (enabled, status)
  WHERE enabled = true AND status = 'ready';

CREATE TABLE IF NOT EXISTS public.rag_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.rag_sources(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(3072),
  embedding_half halfvec(3072),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rag_chunks_source_id_idx ON public.rag_chunks (source_id);

CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('website', 'url', 'file', 'collection')),
  language text,
  base_url text,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.knowledge_sources (source_key, name, source_type, language, base_url, enabled, metadata)
VALUES
  ('babyspace', 'Babyspace', 'website', 'el', 'https://www.babyspace.gr/', true,
   '{"seed": true, "discover": "listing_pages", "since_years": 5, "max_urls": 2000, "max_discover_pages": 250}'::jsonb),
  ('myparenthood', 'My Parenthood', 'website', 'el', 'https://myparenthood.gr/blog/', true,
   '{"seed": true, "discover": "sitemap", "sitemap": "https://myparenthood.gr/post-sitemap.xml", "max_urls": 80}'::jsonb)
ON CONFLICT (source_key) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  language = EXCLUDED.language,
  enabled = EXCLUDED.enabled,
  metadata = EXCLUDED.metadata,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.rag_seed_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'discovering', 'running', 'completed', 'failed', 'cancelled')),
  since_years double precision DEFAULT 5,
  batch_size int NOT NULL DEFAULT 5,
  discover_page int NOT NULL DEFAULT 1,
  max_discover_pages int NOT NULL DEFAULT 250,
  urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  cursor_idx int NOT NULL DEFAULT 0,
  discovered int NOT NULL DEFAULT 0,
  ingested int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  last_error text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rag_seed_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

DROP POLICY IF EXISTS "Admin select rag_sources" ON public.rag_sources;
CREATE POLICY "Admin select rag_sources" ON public.rag_sources FOR SELECT TO authenticated USING (public.is_app_admin());
DROP POLICY IF EXISTS "Admin insert rag_sources" ON public.rag_sources;
CREATE POLICY "Admin insert rag_sources" ON public.rag_sources FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admin update rag_sources" ON public.rag_sources;
CREATE POLICY "Admin update rag_sources" ON public.rag_sources FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admin delete rag_sources" ON public.rag_sources;
CREATE POLICY "Admin delete rag_sources" ON public.rag_sources FOR DELETE TO authenticated USING (public.is_app_admin());

DROP POLICY IF EXISTS "Admin select rag_chunks" ON public.rag_chunks;
CREATE POLICY "Admin select rag_chunks" ON public.rag_chunks FOR SELECT TO authenticated USING (public.is_app_admin());
DROP POLICY IF EXISTS "Admin insert rag_chunks" ON public.rag_chunks;
CREATE POLICY "Admin insert rag_chunks" ON public.rag_chunks FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admin update rag_chunks" ON public.rag_chunks;
CREATE POLICY "Admin update rag_chunks" ON public.rag_chunks FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
DROP POLICY IF EXISTS "Admin delete rag_chunks" ON public.rag_chunks;
CREATE POLICY "Admin delete rag_chunks" ON public.rag_chunks FOR DELETE TO authenticated USING (public.is_app_admin());

-- match_chunks (cosine over halfvec when present, else vector)
DROP FUNCTION IF EXISTS public.match_chunks(vector, integer, double precision);
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
      CASE
        WHEN rc.embedding_half IS NOT NULL THEN
          (1 - (rc.embedding_half <=> query_embedding::halfvec(3072)))::double precision
        ELSE
          (1 - (rc.embedding <=> query_embedding))::double precision
      END AS similarity
    FROM public.rag_chunks AS rc
    WHERE rc.embedding_half IS NOT NULL OR rc.embedding IS NOT NULL
    ORDER BY
      CASE
        WHEN rc.embedding_half IS NOT NULL THEN rc.embedding_half <=> query_embedding::halfvec(3072)
        ELSE rc.embedding <=> query_embedding
      END
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

-- Optional HNSW (best-effort; ignore if compute too small)
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS rag_chunks_embedding_half_hnsw
  ON public.rag_chunks
  USING hnsw (embedding_half halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'HNSW index skipped: %', SQLERRM;
END $$;

-- ── public offers/promotions RPCs ──────────────────────────────────────────
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
    AND COALESCE(o.is_deleted, false) = false
    AND (o.expires_at IS NULL OR o.expires_at::date >= CURRENT_DATE)
    AND (
      p_lang IS NULL
      OR COALESCE(o.lang, 'all') = 'all'
      OR o.lang = p_lang
    )
    AND (
      NOT EXISTS (SELECT 1 FROM public.offer_regions orr WHERE orr.offer_id = o.id)
      OR p_lang IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.offer_regions orr
        JOIN public.regions r ON r.id = orr.region_id AND r.active = true AND COALESCE(r.is_deleted, false) = false
        WHERE orr.offer_id = o.id AND p_lang = ANY (r.languages)
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
    AND COALESCE(p.is_deleted, false) = false
    AND (p.expires_at IS NULL OR p.expires_at::date >= CURRENT_DATE)
    AND (
      NOT EXISTS (SELECT 1 FROM public.promotion_regions pr WHERE pr.promotion_id = p.id)
      OR p_lang IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.promotion_regions pr
        JOIN public.regions r ON r.id = pr.region_id AND r.active = true AND COALESCE(r.is_deleted, false) = false
        WHERE pr.promotion_id = p.id AND p_lang = ANY (r.languages)
      )
    )
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_active_offers(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_promotions(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_offers(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_promotions(text) TO anon, authenticated;

-- promotions RLS (parity with offers)
DROP POLICY IF EXISTS "Authenticated read promotions" ON public.promotions;
CREATE POLICY "Authenticated read promotions"
ON public.promotions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert promotions" ON public.promotions;
CREATE POLICY "Authenticated insert promotions"
ON public.promotions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Anon insert promotions" ON public.promotions;
CREATE POLICY "Anon insert promotions"
ON public.promotions FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated update promotions" ON public.promotions;
CREATE POLICY "Authenticated update promotions"
ON public.promotions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Anon update promotions" ON public.promotions;
CREATE POLICY "Anon update promotions"
ON public.promotions FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated delete promotions" ON public.promotions;
CREATE POLICY "Authenticated delete promotions"
ON public.promotions FOR DELETE TO authenticated USING (true);
DROP POLICY IF EXISTS "Anon delete promotions" ON public.promotions;
CREATE POLICY "Anon delete promotions"
ON public.promotions FOR DELETE TO anon USING (true);

NOTIFY pgrst, 'reload schema';
