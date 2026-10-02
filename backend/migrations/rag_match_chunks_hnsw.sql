-- Fast RAG match_chunks for ~10k chunks × 3072-d embeddings.
-- Expression indexes on casting vector→halfvec were not used by the planner;
-- a dedicated halfvec column + HNSW index is reliable.
--
-- Run once in the Supabase SQL Editor (production).

SET statement_timeout TO '20min';

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.rag_chunks
  ADD COLUMN IF NOT EXISTS embedding_half halfvec(3072);

UPDATE public.rag_chunks
SET embedding_half = embedding::halfvec(3072)
WHERE embedding_half IS NULL AND embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS rag_chunks_embedding_half_hnsw
ON public.rag_chunks
USING hnsw (embedding_half halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);

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

-- Keep new ingests in sync: app should also write embedding_half when inserting.
-- Until then, backfill periodically with the UPDATE above.
