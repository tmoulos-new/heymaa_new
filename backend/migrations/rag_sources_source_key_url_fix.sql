-- Full fix: add missing columns, backfill, dedupe, then unique index.
-- Run once in Supabase SQL Editor (production). Prefer "Run and enable RLS".

BEGIN;

ALTER TABLE public.rag_sources
  ADD COLUMN IF NOT EXISTS source_key text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill URL from origin.
UPDATE public.rag_sources
SET source_url = origin
WHERE (source_url IS NULL OR source_url = '')
  AND origin IS NOT NULL
  AND origin <> ''
  AND origin ~* '^https?://';

-- Best-effort source_key from known domains.
UPDATE public.rag_sources
SET source_key = 'babyspace'
WHERE (source_key IS NULL OR source_key = '')
  AND coalesce(origin, source_url, '') ILIKE '%babyspace.gr%';

UPDATE public.rag_sources
SET source_key = 'myparenthood'
WHERE (source_key IS NULL OR source_key = '')
  AND coalesce(origin, source_url, '') ILIKE '%myparenthood.gr%';

-- Delete chunks for duplicate URL rows (keep best row per source_url).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY source_url
      ORDER BY
        CASE WHEN lower(coalesce(status, '')) = 'ready' THEN 0 ELSE 1 END,
        coalesce(chunk_count, 0) DESC,
        coalesce(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM public.rag_sources
  WHERE source_url IS NOT NULL AND source_url <> ''
),
dupes AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.rag_chunks
WHERE source_id IN (SELECT id FROM dupes);

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY source_url
      ORDER BY
        CASE WHEN lower(coalesce(status, '')) = 'ready' THEN 0 ELSE 1 END,
        coalesce(chunk_count, 0) DESC,
        coalesce(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM public.rag_sources
  WHERE source_url IS NOT NULL AND source_url <> ''
)
DELETE FROM public.rag_sources
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_sources_source_url_unique
  ON public.rag_sources (source_url)
  WHERE source_url IS NOT NULL AND source_url <> '';

CREATE INDEX IF NOT EXISTS idx_rag_sources_source_key
  ON public.rag_sources (source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rag_sources_enabled_ready
  ON public.rag_sources (enabled, status)
  WHERE enabled = true AND status = 'ready';

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
  ('babyspace', 'Babyspace', 'website', 'el', 'https://www.babyspace.gr/', true, '{"seed": true}'::jsonb),
  ('myparenthood', 'My Parenthood', 'website', 'el', 'https://myparenthood.gr/blog/', true,
   '{"seed": true, "sitemap": "https://myparenthood.gr/post-sitemap.xml"}'::jsonb)
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
  status text NOT NULL DEFAULT 'queued',
  since_years double precision NOT NULL DEFAULT 5,
  batch_size integer NOT NULL DEFAULT 5,
  discover_page integer NOT NULL DEFAULT 1,
  max_discover_pages integer NOT NULL DEFAULT 250,
  urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  cursor_idx integer NOT NULL DEFAULT 0,
  discovered integer NOT NULL DEFAULT 0,
  ingested integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  last_error text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rag_seed_jobs_source_key
  ON public.rag_seed_jobs (source_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_seed_jobs_status
  ON public.rag_seed_jobs (status, updated_at DESC);

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_seed_jobs ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

COMMIT;
