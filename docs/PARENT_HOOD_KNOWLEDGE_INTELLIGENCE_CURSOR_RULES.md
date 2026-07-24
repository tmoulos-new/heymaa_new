# Parenthood Knowledge Intelligence Platform — Cursor Rules Pack

## 00 — Project Constitution

This repository implements the Parenthood Knowledge Intelligence Platform (PKIP).

Initial sources:

```text
Babyspace
https://www.babyspace.gr/

My Parenthood
https://myparenthood.gr/blog/
```

These are initial sources only.

The architecture must support adding additional:

```text
websites
individual URLs
PDFs
DOCX
XLSX
CSV
TXT
Markdown
HTML
JSON
```

without redesigning the core semantic, retrieval, or evaluation layers.

Primary flow:

```text
Knowledge Sources
    ↓
Source Registry
    ↓
Acquisition Adapters
    ↓
Canonical Content
    ↓
Semantic Enrichment
    ↓
Knowledge Relations
    ↓
Hybrid Retrieval
    ↓
AI / Search / BI / CRM Applications
```

---

## 01 — Mandatory Engineering Rules

- Inspect existing code before modifying it.
- Do not assume CMS, sitemap, selectors, or URL patterns.
- Discover each website independently.
- Preserve raw source data.
- Preserve content versions.
- Preserve complete provenance.
- Never overwrite source truth with generated interpretation.
- Use PostgreSQL as the system of record.
- Use pgvector for embeddings by default.
- Use hybrid retrieval.
- Version taxonomy, annotations, prompts, models, chunking and embeddings.
- Never silently swallow pipeline failures.
- Make processing retryable and observable.
- Keep secrets in environment variables.
- Do not hard-code API keys.
- Write tests for parsers, normalizers, classifiers and retrieval.
- Prefer composable modules over giant scripts.
- New sources must be added through the source registry or configuration, not by modifying core pipeline logic.

---

## 02 — Source Types

The platform supports:

```text
WEBSITE
URL
FILE
COLLECTION
```

Website example:

```text
https://www.babyspace.gr/
```

Individual URL example:

```text
https://example.com/article
```

File examples:

```text
PDF
DOCX
XLSX
CSV
TXT
MD
HTML
JSON
```

---

## 03 — Source Registry

Use a dynamic source registry.

Conceptual model:

```text
SOURCE
│
├── source_id
├── name
├── source_type
├── language
├── enabled
└── endpoints
```

Example:

```json
{
  "source_key": "babyspace",
  "name": "Babyspace",
  "source_type": "website",
  "language": "el",
  "enabled": true
}
```

Example:

```json
{
  "source_key": "myparenthood",
  "name": "My Parenthood",
  "source_type": "website",
  "language": "el",
  "enabled": true
}
```

Source endpoints may include:

```text
base_url
page_url
sitemap
uploaded_file
```

Do not hard-code the two initial sources into crawler or semantic logic.

---

## 04 — Acquisition Adapter Rules

Use a common adapter contract:

```text
AcquisitionAdapter
    ├── WebsiteAdapter
    ├── UrlAdapter
    ├── PdfAdapter
    ├── DocxAdapter
    ├── XlsxAdapter
    ├── CsvAdapter
    ├── TextAdapter
    └── HtmlAdapter
```

Every adapter must:

1. validate input;
2. acquire content;
3. preserve provenance;
4. extract content;
5. produce canonical content;
6. return structured errors.

Do not duplicate semantic enrichment inside source adapters.

---

## 05 — Canonical Acquisition Object

All sources must eventually produce:

```json
{
  "source_id": "...",
  "source_type": "website|url|file",
  "source_reference": "...",
  "original_location": "...",
  "title": "...",
  "language": "el",
  "content": "...",
  "metadata": {},
  "provenance": {}
}
```

Downstream processing must not care whether the input came from a website or file.

---

## 06 — Provenance Rules

Every document must retain applicable fields:

```text
source_id
source_type
source_domain
source_url
canonical_url
source_content_id
file_name
file_hash
acquisition_timestamp
```

A document must always be traceable to its original source.

---

## 07 — Database Rules

Use PostgreSQL schemas:

```text
source
content
semantic
retrieval
evaluation
system
```

Minimum source tables:

```text
source.sources
source.source_endpoints
source.crawl_runs
source.source_urls
source.raw_documents
```

Minimum content tables:

```text
content.content_documents
content.content_versions
content.content_sections
content.content_media
```

Minimum semantic tables:

```text
semantic.taxonomy_versions
semantic.taxonomy_nodes
semantic.annotation_runs
semantic.document_annotations
semantic.document_taxonomy_links
semantic.age_ranges
semantic.entities
semantic.document_entities
semantic.questions
semantic.document_questions
semantic.relationships
```

Minimum retrieval tables:

```text
retrieval.chunks
retrieval.embeddings
```

Use migrations.

Never modify production schema manually without a migration.

---

## 08 — Crawler Rules

For each website, independently discover:

- robots.txt;
- sitemaps;
- sitemap indexes;
- RSS/Atom feeds;
- internal links;
- canonical URLs;
- structured metadata.

Never assume:

- WordPress;
- a fixed sitemap;
- a fixed article path;
- a fixed HTML structure.

The crawler must be configurable.

---

## 09 — URL Rules

Store:

```text
original_url
normalized_url
canonical_url
url_hash
```

Normalization must explicitly address:

- host casing;
- fragments;
- tracking parameters;
- duplicate query parameters;
- URL encoding;
- trailing slash policy.

Never remove query parameters blindly.

---

## 10 — File Processing Rules

Use type-specific extraction.

### PDF

Preserve:

```text
page
text
metadata
tables where possible
```

### DOCX

Preserve:

```text
paragraphs
headings
tables
metadata
```

### XLSX / CSV

Do not blindly flatten structured data into prose.

Preserve where possible:

```text
workbook
sheet
row
column
cell
table
```

### TXT / MD / HTML / JSON

Preserve structure and metadata where available.

---

## 11 — Cross-Source Semantics

Different sources may discuss the same subject.

Preserve each original document.

Represent relationships explicitly:

```text
SAME_TOPIC
SIMILAR_CONTENT
COMPLEMENTARY
CONTRADICTORY
REFERENCES
RELATED
```

Semantic similarity is not factual equivalence.

Never overwrite source content with cross-source interpretation.

---

## 12 — Source-Aware Retrieval

Support:

```text
ALL_SOURCES
SOURCE_ONLY
SELECTED_SOURCE_SET
```

Examples:

```text
Search all knowledge
Search Babyspace only
Search My Parenthood only
Search Babyspace + uploaded research
```

Source filtering must be metadata-driven.

Do not automatically favour a source because it has more documents.

---

## 13 — Source Quality

Track independently:

```text
crawl success
extraction success
duplicate rate
semantic confidence
retrieval quality
freshness
processing failures
```

Disabling a source must not delete historical data.

---

## 14 — Semantic Taxonomy

The taxonomy is multidimensional.

Minimum dimensions:

```text
LIFE_STAGE
DOMAIN
TOPIC
AGE_RANGE
CONTENT_ROLE
USER_INTENT
QUESTION_TYPE
EMOTIONAL_CONTEXT
SAFETY_LEVEL
COMMERCIAL_RELEVANCE
AUDIENCE
```

All taxonomy nodes must be versioned.

---

## 15 — Age Rules

Represent age numerically.

Correct:

```json
{
  "min_months": 18,
  "max_months": 36
}
```

Support:

- months;
- pregnancy weeks;
- trimester;
- developmental stage.

---

## 16 — Chunking Rules

Do not use only fixed-size token splitting.

Supported chunk types:

```text
SECTION
QUESTION
FACT
SUMMARY
CONTEXTUAL
```

Required metadata:

```text
document_id
content_version_id
section_id
chunk_type
chunk_order
source_id
source_url
title
semantic metadata
chunking_version
```

---

## 17 — Retrieval Rules

Retrieval must combine:

```text
VECTOR SEARCH
+
FULL-TEXT SEARCH
+
METADATA FILTERING
+
QUESTION MATCHING
+
OPTIONAL RELATIONSHIP SEARCH
```

Default pipeline:

```text
User Query
    ↓
Query Understanding
    ↓
Source / Metadata Filters
    ↓
Parallel Retrieval
    ↓
Result Fusion
    ↓
Reranking
    ↓
Context Assembly
    ↓
LLM Generation
```

Nearest-vector does not automatically mean best result.

---

## 18 — Safety Rules

Health content must be safety-classified.

Levels:

```text
S0_GENERAL
S1_LOW
S2_MODERATE
S3_HIGH
S4_URGENT
```

The system must not:

- diagnose;
- invent treatment;
- invent medical facts;
- turn associations into certainties;
- suppress urgent escalation.

---

## 19 — Commercial Rules

Commercial relevance is metadata.

It must not silently alter:

```text
semantic relevance
```

Maintain separation between:

```text
editorial knowledge
```

and:

```text
commercial opportunity
```

---

## 20 — Versioning Rules

Version all of the following:

```text
source content
taxonomy
annotation run
model
prompt
chunking
embedding
```

Never silently replace historical derived data.

---

## 21 — Testing Rules

Minimum test coverage should include:

```text
source registration
URL normalization
robots/sitemap discovery
HTML extraction
file extraction
content cleaning
duplicate detection
canonicalization
taxonomy classification
age extraction
entity extraction
question generation
safety classification
chunking
embedding generation
vector retrieval
hybrid retrieval
source filtering
```

Maintain a golden question dataset.

Track:

```text
Recall@5
Recall@10
Precision@5
MRR
NDCG
Topic Accuracy
Age Accuracy
Intent Accuracy
Safety Accuracy
Groundedness
Source Diversity
```

---

## 22 — Cursor Agent Behaviour

When asked to implement a feature:

1. Inspect relevant files.
2. Inspect source registry and adapter architecture.
3. Identify existing conventions.
4. Explain the implementation plan briefly.
5. Make the smallest coherent change.
6. Run relevant tests.
7. Fix failures.
8. Run type checking and linting where available.
9. Validate migrations.
10. Report:
   - files changed;
   - migrations added;
   - tests run;
   - remaining limitations.

Do not refactor unrelated code unless required.

---

## 23 — Definition of Done

A feature is complete only when:

- code exists;
- tests exist;
- error paths are handled;
- configuration is externalized;
- migrations exist where required;
- logs are useful;
- documentation is updated;
- no secrets are hard-coded;
- regression tests pass.

---

## 24 — Architectural North Star

The platform must evolve toward:

```text
                 ┌────────────────────┐
                 │  KNOWLEDGE ENGINE  │
                 └─────────┬──────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
 Intelligent Search   AI Companion       CRM / BI
```

The initial Babyspace and My Parenthood sources are seed sources only.

The system must be capable of adding:

```text
new websites
new individual URLs
new files
new source collections
```

without redesigning the core semantic intelligence layer.

Build the knowledge engine first.
