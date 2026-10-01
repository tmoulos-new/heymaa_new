-- Speed up RAG match_chunks after multi-site ingest (~10k chunks × 3072-d).
-- Without an ANN index, match_chunks hits statement_timeout and chat retrieval fails.
--
-- Run once in the Supabase SQL Editor (production).
-- Requires pgvector with halfvec support (Supabase default in recent projects).

CREATE EXTENSION IF NOT EXISTS vector;

-- Expression HNSW index over halfvec keeps 3072-d embeddings searchable.
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_halfvec_hnsw
ON public.rag_chunks
USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Recreate match_chunks to use the halfvec distance operator and skip disabled sources.
-- Adjust RETURN types if your existing function differs — check with:
--   select pg_get_functiondef(oid) from pg_proc where proname = 'match_chunks';

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
    c.id,
    c.source_id,
    c.content,
    c.metadata,
    (1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)))::double precision AS similarity
  FROM public.rag_chunks AS c
  LEFT JOIN public.rag_sources AS s ON s.id = c.source_id
  WHERE
    (s.id IS NULL OR COALESCE(s.enabled, true) = true)
    AND (s.id IS NULL OR COALESCE(s.status, 'ready') = 'ready')
    AND 1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) >= match_threshold
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT GREATEST(match_count, 1);
$$;

-- Optional cleanup: babyspace URLs wrongly tagged during multi-site sync.
UPDATE public.rag_sources
SET source_key = 'babyspace'
WHERE (origin ILIKE '%babyspace.gr%' OR source_url ILIKE '%babyspace.gr%')
  AND COALESCE(source_key, '') <> 'babyspace';

UPDATE public.rag_chunks c
SET metadata = jsonb_set(COALESCE(c.metadata, '{}'::jsonb), '{source_key}', '"babyspace"', true)
FROM public.rag_sources s
WHERE c.source_id = s.id
  AND (s.origin ILIKE '%babyspace.gr%' OR s.source_url ILIKE '%babyspace.gr%')
  AND COALESCE(c.metadata->>'source_key', '') <> 'babyspace';
