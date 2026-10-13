-- Run after 003_rag_io_and_advisor_fixes.sql (and after app writes halfvec-only).
-- Frees ~200MB of duplicate full vector(3072) storage. HNSW uses embedding_half.
-- VACUUM FULL reclaims disk to the OS; plain VACUUM only marks space reusable.

SET statement_timeout TO '30min';

UPDATE public.rag_chunks
SET embedding = NULL
WHERE embedding IS NOT NULL;

-- Prefer off-peak; locks the table briefly and uses Disk IO:
-- VACUUM (FULL, ANALYZE) public.rag_chunks;
VACUUM (ANALYZE) public.rag_chunks;
