-- Durable RAG website seed jobs (Babyspace archive, etc.).
-- Run in Supabase SQL editor. Until applied, seed-job APIs return a clear error.

CREATE TABLE IF NOT EXISTS public.rag_seed_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'discovering', 'running', 'completed', 'failed', 'cancelled'
    )),
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

CREATE INDEX IF NOT EXISTS idx_rag_seed_jobs_status_updated
  ON public.rag_seed_jobs (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_seed_jobs_source_key
  ON public.rag_seed_jobs (source_key, created_at DESC);

ALTER TABLE public.rag_seed_jobs ENABLE ROW LEVEL SECURITY;
