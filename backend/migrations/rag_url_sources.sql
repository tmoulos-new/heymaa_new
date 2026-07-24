-- Extend RAG for URL / website knowledge sources (PKIP seed support).
-- Run in Supabase SQL Editor. Idempotent.

ALTER TABLE public.rag_sources
  ADD COLUMN IF NOT EXISTS source_key text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_sources_source_url_unique
  ON public.rag_sources (source_url)
  WHERE source_url IS NOT NULL AND source_url <> '';

CREATE INDEX IF NOT EXISTS idx_rag_sources_source_key
  ON public.rag_sources (source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rag_sources_enabled_ready
  ON public.rag_sources (enabled, status)
  WHERE enabled = true AND status = 'ready';

-- Lightweight registry for website/file collections (config, not hard-coded crawlers).
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
  (
    'babyspace',
    'Babyspace',
    'website',
    'el',
    'https://www.babyspace.gr/',
    true,
    '{"seed": true, "notes": "PKIP initial source"}'::jsonb
  ),
  (
    'myparenthood',
    'My Parenthood',
    'website',
    'el',
    'https://myparenthood.gr/blog/',
    true,
    '{"seed": true, "notes": "PKIP initial source", "sitemap": "https://myparenthood.gr/post-sitemap.xml"}'::jsonb
  )
ON CONFLICT (source_key) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  language = EXCLUDED.language,
  enabled = EXCLUDED.enabled,
  metadata = EXCLUDED.metadata,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
