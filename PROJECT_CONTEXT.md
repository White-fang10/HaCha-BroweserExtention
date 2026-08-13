# HaCha AI Fact Checker — Master Architecture, Project Context & Steering Guide

> **Document Status:** Authoritative Master Reference  
> **Purpose:** This context file serves as the definitive single source of truth for the HaCha AI Fact Checker architecture, flow, boundaries, and implementation invariants. If ongoing development drifts or takes a wrong direction, this document must be used to audit, align, and reset the project to its correct track.

---

## 1. System Executive Summary & Core Philosophy

**HaCha AI Fact Checker** is a privacy-first, evidence-grounded browser extension and microservices platform designed to verify viral claims found on web pages (social media posts, article paragraphs, image text, memes, infographics) in real time.

### Key Architectural Invariants & Core Principles
1. **User-Driven Region Selection over Global Scraping:**  
   The user explicitly points to the content to check by dragging a rectangular bounding box. HaCha checks *only* what the user explicitly selects (`"Check this"` model), reducing noise, false positives, and unnecessary compute.
2. **Privacy-Preserving Local OCR (Zero Image Upload):**  
   Screen content captured inside the browser is processed locally using **Tesseract.js (WebAssembly)**. Images **NEVER** leave the user's browser device. Only user-confirmed text claims are sent over the network.
3. **Strict 3-Tiered Verification Cascade:**  
   To minimize latency, cost, and API/LLM usage, verification follows a strict order:
   - **Tier 1 — High-Speed Cache:** Check Redis using a deterministic **SHA-256 hash** of the normalized claim.
   - **Tier 2 — Database of Existing Fact-Checks:** Query the **Google Fact Check Tools Claim Search API**.
   - **Tier 3 — AI RAG Pipeline:** Invoke the **Python AI Service** for evidence retrieval, snippet ranking, and LLM reasoning *only if Tiers 1 & 2 yield no match*.
4. **RAG-Grounded Reasoning over Generative Hallucination:**  
   The LLM acts strictly as a reasoning component over retrieved external evidence. It is explicitly forbidden from making up facts, generating unevidenced verdicts, or hallucinating citations.
5. **Decoupled Microservice Boundaries:**  
   - **Extension:** Chrome Manifest V3 (UI, selection, local OCR, contextual overlay).
   - **Backend Gateway:** Node.js + Express + TypeScript (Input validation, claim normalization, SHA-256 hashing, Redis cache management, Google Fact-Check API routing, request orchestrator).
   - **AI Microservice:** Python + FastAPI + PyTorch/Pydantic (Web search retrieval, article parsing, evidence extraction/ranking, RAG, LLM inference).

---

## 2. Complete End-to-End Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   BROWSER (Client Side)                                 │
│                                                                                         │
│  User Activates ──► Region Selection UI ──► Canvas Crop ──► Local WASM OCR (Tesseract)  │
│                                                                      │                  │
│  Contextual Overlay ◄── Render Result ◄── Content Script ◄── Edit/Confirm Claim Text    │
└──────────────────────────────────────────────────────────┬──────────────────────────────┘
                                                           │ POST /api/verify
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 NODE.JS BACKEND GATEWAY                                 │
│                                                                                         │
│  Input Validation & Rate Limiting                                                       │
│         │                                                                               │
│  Claim Normalization (Clean, preserve dates/numbers/negations)                          │
│         │                                                                               │
│  Generate SHA-256 Claim Hash                                                            │
│         │                                                                               │
│  Redis GET (claim:hash:<sha256>) ─────── HIT ─────────────► Return Cached Verdict       │
│         │                                                                               │
│       MISS                                                                              │
│         ▼                                                                               │
│  Google Fact Check API Search ───────── MATCH ────────────► Cache in Redis & Return     │
│         │                                                                               │
│     NO MATCH                                                                            │
│         ▼                                                                               │
│  Forward to Python AI Service (POST /verify)                                            │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  PYTHON AI MICROSERVICE                                 │
│                                                                                         │
│  Query Generation ──► Web Retrieval ──► Boilerplate Removal ──► Evidence Extraction     │
│                                                                        │                │
│  Validated JSON Verdict ◄── LLM Reasoning ◄── RAG Context ◄── Rank Evidence Snippets    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase-by-Phase Roadmap & Milestones

Below is the definitive phase breakdown. Any pull request, module creation, or feature must fit into its designated phase.

| Phase # | Phase Title | Core Deliverables & Focus | Forbidden / Out-of-Scope in this Phase |
|---|---|---|---|
| **Phase 0** | **Project Setup & Scaffolding** | Monorepo setup (`extension/`, `backend/`, `ai-service/`, `docs/`, `docker/`), Docker Compose for Redis & Mongo, TypeScript & Python venv setup, basic health check endpoints. | Extension UI, OCR, Fact-checking logic, LLM integrations. |
| **Phase 1** | **Browser Extension Skeleton** | Chrome Manifest V3 configuration, Popup UI, Background Service Worker, Content Script injection, cross-script message passing mechanism. | Region selection, OCR, API backend calls, external network requests. |
| **Phase 2** | **Region Selection UI** | Dimmed page overlay, interactive rectangular drag-to-select box, DPI scaling, scroll coordinate adjustments, selection coordinate calculation, selection preview. | Tesseract.js, OCR parsing, backend communication. |
| **Phase 3** | **Local OCR (Tesseract.js)** | In-browser WebAssembly OCR worker loading, image preprocessing (grayscale, contrast), text extraction, interactive editable OCR confirmation UI modal. | **Uploading screenshot to backend** (Strictly forbidden!), normalization, caching. |
| **Phase 4** | **Backend Gateway Core** | Node.js + Express + TypeScript server, POST `/api/verify`, GET `/api/health`, request payload validation (zod/Joi), size limits, CORS policies, stubbed verify response. | Normalization hashing, Redis, Google Fact-Check API, AI microservice. |
| **Phase 5** | **Claim Normalization & Hashing** | Text cleaning pipeline (case normalization, whitespace collapsing, unicode standardizing) while **preserving key entities, numbers, percentages, dates, units, and negation**, SHA-256 claim hash generation. | Redis cache storage, Google API, external search. |
| **Phase 6** | **Redis Caching Layer** | Redis connection setup, key naming convention (`claim:hash:<sha256>`), GET/SET operations, TTL policy (e.g. 7-30 days), cache HIT/MISS branching in Express gateway. | Google Fact Check API, Python AI service. |
| **Phase 7** | **Fact-Check Database Integration** | Google Fact Check Tools Claim Search API client (`/v1alpha1/claims:search`), rating mapping to HaCha taxonomy, publisher attribution, caching API hits in Redis. | Web scraping, arbitrary search engine RAG, LLM calls. |
| **Phase 8** | **AI Microservice Skeleton** | Python 3.10+ FastAPI application, Pydantic request/response schemas, async `/health`, `/ready`, `/verify` endpoints, Express-to-FastAPI HTTP client, request correlation IDs. | Web retrieval, PyTorch/vector embeddings, RAG, LLM inference. |
| **Phase 9** | **Evidence Retrieval Pipeline** | Search query generator, multi-provider web retrieval abstraction, URL deduplication, domain authority/recency scoring, HTML content parsing & boilerplate removal, evidence snippet extraction & ranking. | LLM reasoning, verdict generation (Output is evidence package only). |
| **Phase 10** | **RAG + LLM Reasoning** | Grounded RAG context builder, system prompt injection defenses, LLM integration, strict JSON output schema validation, taxonomy classification, confidence bounding [0.0–1.0], citation tracking. | Extension overlay styling, frontend rendering. |
| **Phase 11** | **Contextual Overlay UI** | Extension Shadow DOM overlay card, viewport collision detection, positioning near selected box, loading/verifying states, taxonomy color codes, expandable source links, state machine enforcement. | Backend modifications, new API fields. |
| **Phase 12** | **Security Hardening** | Extension minimal permissions (`activeTab`, `storage`), SSRF prevention (IP filtering, URL validation), XSS defenses (Shadow DOM, strict HTML escaping), rate limiting, prompt injection defenses, credential sanitization. | Functional feature additions. |
| **Phase 13** | **Evaluation & Metrics** | Standardized benchmark dataset creation, Word Error Rate (WER) for OCR, cache hit ratio tracking, Retrieval MRR/NDCG, RAG correctness & grounding evaluation, latency P95 profiling, error category taxonomy. | Architectural refactoring. |
| **Phase 14** | **Packaging & Deployment** | Production Docker Compose, environment configuration segregation (`.env.production`), secrets management, health checks, CI/CD workflow, production build scripts, Chrome Web Store zip bundle. | Breaking schema or contract changes. |

---

## 4. Strict Taxonomy & Response Schemas

### 4.1 Verdict Taxonomy
All verification responses across Gateway, AI Service, and UI **MUST** strictly output one of the following 4 standardized verdict classifications:

1. `SUPPORTED` — The claim is backed by authoritative evidence or official fact-check reviews.
2. `FALSE` — The claim is explicitly disproved or contradicted by credible sources.
3. `MISLEADING` — The claim contains partial truth, missing context, altered media, or exaggerated numbers.
4. `UNVERIFIED` — Insufficient evidence exists, or sources are conflicting/inconclusive.

### 4.2 Standard API Verification Payload (`POST /api/verify`)

```json
{
  "claimId": "claim:hash:a3f1b980e2...",
  "normalizedClaim": "nasa confirms earth will experience 3 days of darkness",
  "verdict": "FALSE",
  "confidence": 0.95,
  "explanation": "NASA has issued no such warning. The claim originates from a recurring internet hoax first circulated in 2012.",
  "sources": [
    {
      "title": "No, NASA Did Not Warn of 3 Days of Darkness",
      "url": "https://www.factcheck.org/2014/10/nasa-darkness-hoax/",
      "publisher": "FactCheck.org",
      "publishDate": "2014-10-30",
      "reliabilityScore": 0.92
    }
  ],
  "sourceTier": "FACT_CHECK_API", 
  "cached": true,
  "timestamp": "2026-08-13T14:27:00Z"
}
```

*Note on `sourceTier`: Must be one of `REDIS_CACHE`, `FACT_CHECK_API`, or `AI_RAG`.*

---

## 5. Course-Correction Checklist (What to do when Development goes Off-Track)

If developer activity, code reviews, or agent implementations start deviating from the design, perform the following alignment audit immediately:

### Audit 1: Privacy & Client Boundaries
- [ ] **Violation:** Is an image, canvas data URL, or screenshot being uploaded to the Express Gateway or Python Backend?  
  - **Correction:** Immediately STOP. Revert backend image processing. Screenshots must only exist temporarily in browser memory, passed through local Tesseract.js WASM, and discarded after OCR text is extracted.

### Audit 2: Verification Cascade Integrity
- [ ] **Violation:** Is the system calling the Python AI Service or LLM directly for every request, bypassing Redis or Google Fact Check API?  
  - **Correction:** Re-establish the cascade in Node.js Express Gateway: `Check Redis -> If Miss, Check Google Fact Check API -> If No Match, Call Python AI Service`.

### Audit 3: Normalization & Hashing
- [ ] **Violation:** Is Redis caching using the raw user OCR string as the key?  
  - **Correction:** Restore Phase 5 claim normalization. Hash *only* the canonical normalized claim string using SHA-256 (`claim:hash:<sha256>`). Raw claims with extra spaces or different casing MUST resolve to the identical cache key.

### Audit 4: Service Boundaries
- [ ] **Violation:** Are LLM calls, PyTorch embeddings, or python scripts being executed inside the Node.js Express Gateway (or vice versa)?  
  - **Correction:** Re-enforce service separation. Node.js Express is strictly an API Gateway and orchestrator. Python FastAPI is exclusively responsible for AI/RAG/Retrieval.

### Audit 5: LLM Hallucination Guardrails
- [ ] **Violation:** Is the LLM answering claims using its internal weights without retrieved source snippets?  
  - **Correction:** Update Phase 10 RAG prompts and pipelines. If retrieval produces zero evidence snippets, the AI service MUST return `UNVERIFIED` with `confidence: 0.0` instead of guessing.

### Audit 6: Extension Shadow DOM Isolation
- [ ] **Violation:** Is the overlay UI injecting raw HTML directly into the host webpage DOM, causing style collisions or XSS vulnerability?  
  - **Correction:** Wrap all extension UI components inside a closed/open **Shadow DOM root** (`attachShadow({ mode: 'open' })`) and pass all text content through strict sanitization.

---

## 6. Monorepo File Map Reference

```text
hacha-ai/
├── extension/             # Chrome Extension (Manifest V3)
│   ├── manifest.json      # Extension manifest
│   ├── src/
│   │   ├── background/    # Service worker
│   │   ├── content/       # Content scripts (Selection, OCR, Overlay)
│   │   │   ├── selection/ # Selection Manager & Canvas overlay
│   │   │   ├── ocr/       # Tesseract.js WASM wrapper & Edit dialog
│   │   │   └── overlay/   # Shadow DOM Result Card UI
│   │   └── popup/         # Popup interface
│   ├── package.json
│   └── tsconfig.json
│
├── backend/               # Node.js Express API Gateway
│   ├── src/
│   │   ├── config/        # Env & Redis/Mongo configs
│   │   ├── middleware/    # Validation, Rate limiting, CORS, Errors
│   │   ├── routes/        # /api/health, /api/verify
│   │   ├── services/      # Normalization, Hashing, Redis, FactCheckAPI, AIServiceClient
│   │   └── server.ts      # Server entry point
│   ├── package.json
│   └── tsconfig.json
│
├── ai-service/            # Python FastAPI AI & RAG Microservice
│   ├── app/
│   │   ├── api/           # FastAPI routers (/health, /ready, /verify)
│   │   ├── core/          # App config, logging, security
│   │   ├── models/        # Pydantic schemas
│   │   └── services/      # QueryGen, WebSearch, Extractor, Ranker, RAG, LLM
│   ├── main.py            # FastAPI entry point
│   └── requirements.txt
│
├── docker/
│   └── docker-compose.yml # Redis, MongoDB, Gateway, AI Service stack
│
└── phase details/         # Detailed step-by-step guides for Phases 0 to 14
```

---

*This document must be referenced whenever commencing work on a new phase or refactoring existing modules.*
