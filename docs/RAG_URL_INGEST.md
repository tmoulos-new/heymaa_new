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

## Re-seed (CLI)

```bash
.\.venv\Scripts\python.exe backend\ingest_parenthood_urls.py --source babyspace --max-per-source 500
```

## No-timeout admin seed jobs (Babyspace last 5 years)

1. Run `backend/migrations/rag_seed_jobs.sql` in the Supabase SQL editor (once).
2. In Admin → RAG Sources → **Start Babyspace (last 5 years)**.
3. The UI creates a job and repeatedly calls `/tick` (a few listing pages or ~5 URL ingests each time), so each request stays under Vercel’s timeout.
4. Leave the tab open until status is `completed`, or click **Cancel**.

APIs:

- `POST /admin/rag_sources/seed_jobs` — start
- `POST /admin/rag_sources/seed_jobs/{id}/tick` — one safe step
- `GET /admin/rag_sources/seed_jobs/{id}` — status
- `POST /admin/rag_sources/seed_jobs/{id}/cancel` — stop
