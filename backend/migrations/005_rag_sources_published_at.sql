-- Store article publish date from source pages (JSON-LD / meta / <time>).
-- created_at remains ingest time; published_at is the article's own date when known.

ALTER TABLE public.rag_sources
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS rag_sources_published_at_idx
  ON public.rag_sources (published_at DESC NULLS LAST);

COMMENT ON COLUMN public.rag_sources.published_at IS
  'Article publish date extracted from the source page when available.';

NOTIFY pgrst, 'reload schema';
