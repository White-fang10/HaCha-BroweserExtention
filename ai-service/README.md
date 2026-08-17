# HaCha AI Verification Service - Phase 9

## Overview

Python FastAPI microservice for evidence-grounded claim verification. Phase 9 implements the
**Evidence Retrieval Pipeline** — given a claim not resolved by Redis or existing fact-check
databases, the service generates search queries, retrieves candidate sources, filters low-quality
or unsafe results, extracts relevant evidence, ranks it, and returns a bounded evidence package
for Phase 10's RAG + LLM reasoning layer.

## Architecture

```text
Chrome Extension
       ↓
Node.js Gateway
       ↓ HTTP (Bearer token)
Python AI Service (FastAPI)
       ↓
Evidence Retrieval Pipeline (Phase 9)
  Claim Analysis → Query Generation → Search
    → Source Filtering (SSRF-safe) → Content Fetching
    → Content Extraction → Evidence Extraction → Ranking
    → Evidence Package
       ↓
Phase 10: RAG + LLM Reasoning (future)
```

## Components

- **Claim Analysis** (`claim_analyzer.py`) — Extracts entities, numbers, dates, organizations,
  predicate, subject/object, temporal expressions, and classifies claim type.
- **Query Generation** (`query_generator.py`) — Produces bounded, non-hallucinated search queries
  (direct, entity+predicate, evidence, study, fact-check).
- **Search Provider Abstraction** (`providers/search/`) — Pluggable interface with Brave, SerpAPI,
  and Mock implementations.
- **Source Filtering** (`source_filter.py`) — URL normalization, SSRF protection (private IPs,
  cloud metadata, localhost), per-domain limits, source-type classification, quality scoring.
- **Content Fetcher** (`content_fetcher.py`) — Bounded concurrency, timeouts, size limits,
  content-type validation, redirect re-validation.
- **Content Extractor** (`content_extractor.py`) — trafilatura + BeautifulSoup fallback for
  main-article extraction with boilerplate removal.
- **Evidence Extractor** (`evidence_extractor.py`) — Chunking, relevance scoring, direction
  estimation (supports/contradicts/contextual/unclear).
- **Evidence Ranker** (`evidence_ranker.py`) — Quality scoring, near-duplicate removal, domain
  diversity, combined ranking, retrieval-status determination.

## Endpoints

- `GET /health` - Liveness probe
- `GET /ready` - Readiness probe (checks search provider health)
- `POST /verify` - Verification request (requires internal token)

Phase 9 returns an evidence-based preliminary verdict derived deterministically from the
retrieval package. The authoritative LLM-reasoned verdict arrives in Phase 10.

## Configuration

Copy `.env.example` to `.env` and adjust values:

```bash
SEARCH_PROVIDER=mock          # mock | brave | serpapi
BRAVE_SEARCH_API_KEY=...      # when using brave
SERPAPI_API_KEY=...           # when using serpapi
RETRIEVAL_MAX_QUERIES=5
RETRIEVAL_MAX_RESULTS_PER_QUERY=10
RETRIEVAL_MAX_CONCURRENT_FETCHES=5
RETRIEVAL_MAX_EVIDENCE_ITEMS=10
RETRIEVAL_FETCH_TIMEOUT_SECONDS=10
RETRIEVAL_MAX_CONTENT_SIZE_MB=10
RETRIEVAL_MAX_PER_DOMAIN=3
```

## Testing

```bash
pytest -v
```

## What Phase 9 Does NOT Implement

- ❌ Final TRUE/FALSE decision by an LLM
- ❌ RAG prompt construction
- ❌ LLM inference
- ❌ Automatic acceptance of search snippets as facts
- ❌ Unbounded web crawling

Those belong to Phase 10.
