# RAG URL / website knowledge sources

## What was added

- URL acquisition (`backend/url_acquire.py`): fetch HTML, extract text, discover sitemaps/links
- URL ingest into existing `rag_sources` / `rag_chunks` (`backend/rag_ingest.py`)
- Admin APIs:
  - `POST /admin/rag_sources/ingest_url`
  - `POST /admin/rag_sources/seed_parenthood`
- CLI seeder: `backend/ingest_parenthood_urls.py`
- Chat retrieval already uses `match_chunks`; top_k raised to 6 and URL titles included in context

## Seed sources (PKIP)

- Babyspace — https://www.babyspace.gr/
- My Parenthood — https://myparenthood.gr/blog/ (sitemap: post-sitemap.xml)

## Optional DDL (Supabase SQL Editor)

Run `backend/migrations/rag_url_sources.sql` to add:

- `rag_sources.source_key`, `language`, `source_url`, `enabled`, `updated_at`
- `knowledge_sources` registry table with Babyspace + My Parenthood rows

Until that migration runs, ingest still works using `origin` + `source_type='url'` and stores provenance in chunk `metadata`.

## Re-seed

```bash
.\.venv\Scripts\python.exe backend\ingest_parenthood_urls.py --max-per-source 20
```
