# Babyspace milestones vendorize

Vendorizes [Babyspace](https://www.babyspace.gr/) development content into short checklist bullets for the in-app **Milestones** UI and as RAG seed files.

## Taxonomy

| Band | Stages |
|------|--------|
| Pregnancy | Weeks **1–40** |
| Baby | Months **1–12** |
| Toddler | **12–15**, **15–18**, **18–24**, **24–36** months |
| Child | Years **4–12** (after 36 months → year 4; no separate year-3 band) |

## Refresh (every ~6 months)

```bash
.\.venv\Scripts\python.exe backend\milestones_vendorize.py
```

Useful flags:

- `--skip-translate` — Greek only (use when Gemini quota is tight)
- `--no-gemini` — heuristic extraction only (dash bullets / prose sentences)
- `--stage baby_m6 --stage preg_w20` — re-run specific stages
- `--resolve-only` — rebuild `backend/milestones_cache/url_map.json`

If free-tier Gemini quota is exhausted, extract with `--skip-translate` first, then later:

```bash
.\.venv\Scripts\python.exe backend\milestones_vendorize.py
```

(without `--skip-translate`) to fill `catalog.i18n.json` for all language-bar langs. Until then, non-Greek UI falls back to the previous hardcoded milestone catalogs.

Outputs:

- `frontend/src/data/milestones/catalog.el.json` — canonical Greek bullets + provenance
- `frontend/src/data/milestones/catalog.i18n.json` — all language-bar langs
- `frontend/src/data/milestones/meta.json`
- `backend/knowledge_seed/milestones/*.md` — RAG-ready seeds

Then ingest milestone seeds into RAG:

```bash
.\.venv\Scripts\python.exe backend\ingest_seed_files.py
```

(`ingest_seed_files.py` also reads `backend/knowledge_seed/milestones/*.md`.)

## UI wiring

`frontend/src/lib/milestones.ts` maps age / pregnancy week → stage id and localized bullets. `App.tsx` prefers vendorized lists and falls back to the previous hardcoded catalogs when a stage is empty.
