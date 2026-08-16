# HaCha Backend Gateway

Node.js + Express backend gateway for the HaCha AI Fact Checker extension.

## Phase 4 — Backend Gateway Core

This phase establishes the browser-to-backend contract:
- `GET /api/health` — health check
- `POST /api/verify` — verify a claim (stub response)

No external services (Redis, MongoDB, AI) are required yet.

## Architecture

```
Chrome Extension
       │
       │ Confirmed claim text (JSON only)
       ▼
Node.js Gateway (Express)
       ├── Request ID middleware
       ├── Structured logging
       ├── CORS (extension origin)
       ├── JSON body parser (1mb limit)
       ├── Routes
       │   ├── /api/health
       │   └── /api/verify (Zod validation)
       ├── 404 handler
       └── Centralized error handler
       │
       ▼
Stub Verification Service (returns UNVERIFIED)
```

## Endpoints

### GET /api/health
Returns service health status.

**Response (200):**
```json
{
  "success": true,
  "service": "hacha-backend",
  "status": "healthy",
  "environment": "development",
  "timestamp": "2026-08-16T...",
  "version": "0.1.0"
}
```

### POST /api/verify
Verify a claim through the verification pipeline.

**Request:**
```json
{
  "claim": "NASA confirms Earth will experience three days of darkness."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "claimId": "sha256...",
    "normalizedClaim": "NASA confirms Earth will experience three days of darkness.",
    "verdict": "UNVERIFIED",
    "confidence": 0,
    "explanation": "Verification service not yet implemented. This is a stub response.",
    "sources": [],
    "sourceTier": "AI_RAG",
    "cached": false,
    "timestamp": "2026-08-16T..."
  }
}
```

**Validation errors (400):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "body.claim: Claim cannot be empty"
  }
}
```

## API Contract

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `claim` | string | yes | 1-5000 chars, trimmed |

**Verdict taxonomy:** `SUPPORTED` \| `FALSE` \| `MISLEADING` \| `UNVERIFIED`

**Source tiers:** `REDIS_CACHE` \| `FACT_CHECK_API` \| `AI_RAG`

## Development

```bash
# Install dependencies
npm install

# Run in development (hot reload)
npm run dev

# Build
npm run build

# Start production
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure.

Key variables:
- `NODE_ENV` — development | staging | production
- `PORT` — HTTP port (default 3000)
- `CORS_ORIGIN` — allowed Chrome extension origin
- `MAX_CLAIM_LENGTH` — max claim length (default 5000)
- `LOG_LEVEL` — debug | info | warn | error

## Privacy

- No screenshots or images are uploaded.
- Claim text is never logged in full.
- Only metadata (length, hash) is logged for debugging.

## Next Phases

- Phase 5: Claim normalization & hashing
- Phase 6: Redis caching layer
- Phase 7: Google Fact Check API
- Phase 8: Python AI microservice
