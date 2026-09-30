-- Deduplicate rag_sources.source_url, then create the unique index.
-- Keeps the "best" row per URL: ready+chunks first, then newest updated/created.

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
-- Remove chunks for duplicate sources first (in case FK cascade is missing).
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

NOTIFY pgrst, 'reload schema';
