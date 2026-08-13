# HaCha AI Development Rules

Whenever working on the HaCha AI Fact Checker codebase:

1. **Always refer to `PROJECT_CONTEXT.md`** as the authoritative single source of truth for architectural boundaries, database models, phase milestones, and privacy principles.
2. **Never upload images/screenshots to the backend.** OCR must run client-side in the browser using Tesseract.js (WASM).
3. **Respect service boundaries.** Keep Node.js Express Gateway (traffic, validation, normalization, Redis, Fact-Check API) and Python FastAPI AI Microservice (Search retrieval, scraping, RAG, LLM reasoning) strictly decoupled.
4. **Follow the 3-tier verification cascade.** Cache hit (Redis) -> Fact-Check DB hit (Google Fact Check API) -> AI Service (RAG + LLM).
5. **Use standard taxonomy.** All verdicts MUST map to: `SUPPORTED`, `FALSE`, `MISLEADING`, `UNVERIFIED`.
