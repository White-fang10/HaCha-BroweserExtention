# HaCha AI Fact Checker
## Phase 4 — Backend Gateway Core (Node.js + Express)

> **Phase objective:** Create the server-side gateway that receives a user-confirmed textual claim from the Chrome extension, validates it, applies security and request-size controls, and returns a predictable structured response. Phase 4 establishes the browser-to-backend contract without implementing actual fact checking yet.

---

# 1. Phase Overview

Phases 1–3 established the browser-side pipeline:

```text
User
 ↓
Chrome Extension
 ↓
Region Selection
 ↓
Local Screenshot
 ↓
Local OCR
 ↓
Human Confirmation
```

Phase 4 introduces the first network boundary:

```text
Chrome Extension
      │
      │ Confirmed claim text
      ▼
Node.js + Express Gateway
      │
      ▼
Validation
      │
      ▼
Structured Response
```

The gateway becomes the central entry point for all future verification requests.

Later phases will extend it with:

```text
Gateway
   ↓
Claim Normalization
   ↓
Hashing
   ↓
Redis Cache
   ↓
Fact-Check API
   ↓
AI Service
```

But Phase 4 intentionally stops before those systems are implemented.

---

# 2. Core Responsibility of the Gateway

The Node.js gateway should act as the **traffic controller** for HaCha.

It should eventually handle:

- Requests from the Chrome extension
- Input validation
- Authentication/session validation if introduced later
- Rate limiting
- Claim normalization coordination
- Cache lookup
- Fact-check API routing
- AI-service routing
- Response formatting
- Error handling
- Logging
- Metrics

Phase 4 only implements the foundation for these responsibilities.

---

# 3. Phase 4 Goals

By the end of Phase 4:

- Node.js backend runs locally.
- Express is configured correctly.
- TypeScript compilation works.
- `/api/health` works.
- `/api/verify` exists.
- Request bodies are validated.
- Input length limits are enforced.
- Invalid requests return structured errors.
- Valid claims return a stub verification response.
- CORS is configured for the extension development environment.
- Centralized error handling exists.
- Structured logging exists.
- Environment configuration is separated from source code.
- The backend can be called from the Chrome extension.
- The API contract is documented.
- Basic API tests pass.

---

# 4. What Phase 4 Does NOT Implement

Do not implement the following yet:

```text
❌ Claim normalization
❌ SHA-256 hashing
❌ Redis
❌ MongoDB persistence
❌ Google Fact Check API
❌ Search APIs
❌ RAG
❌ LLM
❌ AI microservice
❌ Real verdict generation
❌ Evidence ranking
❌ Production authentication
❌ Production deployment
```

The `/api/verify` endpoint should return a controlled **stub response**.

---

# 5. Architecture After Phase 4

```text
                         USER
                           │
                           ▼
                  Chrome Extension
                           │
                    Confirmed Text
                           │
                           ▼
                 ┌──────────────────┐
                 │ Node.js Gateway  │
                 │    Express       │
                 └────────┬─────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
          Validation   Logging      Errors
              │
              ▼
         Stub Response
```

The future architecture will expand:

```text
Chrome Extension
       │
       ▼
Node.js Gateway
       │
       ├── Redis
       │
       ├── Fact Check API
       │
       └── Python AI Service
                 │
                 ├── Retrieval
                 └── LLM
```

---

# 6. Recommended Backend Structure

The backend should evolve into:

```text
backend/
│
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── routes/
│   │   ├── health.routes.ts
│   │   └── verify.routes.ts
│   │
│   ├── controllers/
│   │   ├── health.controller.ts
│   │   └── verify.controller.ts
│   │
│   ├── schemas/
│   │   └── verify.schema.ts
│   │
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   ├── request-id.ts
│   │   └── not-found.ts
│   │
│   ├── services/
│   │   └── verification.service.ts
│   │
│   ├── types/
│   │   └── api.ts
│   │
│   └── utils/
│       └── logger.ts
│
├── tests/
│   ├── health.test.ts
│   └── verify.test.ts
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

The exact organization can change, but the responsibilities should remain separated.

---

# 7. Application vs Server

Separate:

```text
app.ts
```

from:

```text
server.ts
```

### `app.ts`

Responsible for:

- Express initialization
- Middleware
- Routes
- Error handling

### `server.ts`

Responsible for:

- Reading configuration
- Starting the HTTP server

This makes the Express application easier to test without opening a real network port.

Conceptually:

```text
Tests
  ↓
app.ts

Development/Production
  ↓
server.ts
  ↓
app.ts
```

---

# 8. Express Configuration

The application should configure:

```text
Express
 ↓
JSON body parser
 ↓
Request ID
 ↓
Logging
 ↓
CORS
 ↓
Routes
 ↓
404 handler
 ↓
Error handler
```

Middleware order matters.

Error handling should be placed after route registration.

---

# 9. Environment Configuration

Do not hard-code configuration values.

Create:

```text
.env.example
```

Example:

```env
NODE_ENV=development
PORT=4000
EXTENSION_ORIGIN=chrome-extension://YOUR_EXTENSION_ID
MAX_CLAIM_LENGTH=5000
LOG_LEVEL=info
```

Actual `.env` files must not be committed.

---

# 10. Environment Validation

The application should validate required environment variables during startup.

Example:

```text
Missing PORT
      ↓
Startup failure
      ↓
Clear configuration error
```

Do not allow the server to start with silently invalid configuration.

A configuration library or schema validator can be used.

---

# 11. Development vs Production Configuration

The project should support:

```text
development
staging
production
```

At Phase 4, only development needs to be operational.

However, configuration should already be separated so that production settings do not require source-code changes.

---

# 12. Health Endpoint

Implement:

```http
GET /api/health
```

Expected response:

```json
{
  "success": true,
  "service": "hacha-backend",
  "status": "healthy"
}
```

Optionally include:

```json
{
  "success": true,
  "service": "hacha-backend",
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "..."
}
```

The health endpoint should remain lightweight.

---

# 13. Health Endpoint Purpose

The endpoint will eventually be useful for:

- Local development
- Docker health checks
- Cloud deployment
- Monitoring
- Load balancers
- Debugging

Later, separate:

```text
Liveness
Readiness
```

checks can be introduced if required.

---

# 14. Verification Endpoint

Implement:

```http
POST /api/verify
```

Phase 4 request:

```json
{
  "claim": "NASA confirms Earth will experience three days of darkness."
}
```

The endpoint should validate the request and return a stub response.

---

# 15. Request Schema

Define a strict schema.

Example:

```typescript
interface VerifyRequest {
  claim: string;
}
```

Recommended validation rules:

```text
claim must exist
claim must be a string
claim must not be empty
claim must not exceed MAX_CLAIM_LENGTH
```

Optional later fields should not be accepted unless explicitly defined.

---

# 16. Why Schema Validation Matters

The backend cannot assume that the extension is always the caller.

Requests can be manually constructed.

For example:

```text
curl
Postman
malicious script
modified extension
```

Therefore:

```text
Client input
      ↓
Untrusted
      ↓
Validate
      ↓
Process
```

Never trust the frontend to enforce validation.

---

# 17. Validation Library

Use a schema validation library such as:

```text
Zod
```

or another established TypeScript validation solution.

The project already proposes Zod/Joi in the original architecture.

For consistency, Zod is a strong choice for a TypeScript-first backend.

---

# 18. Claim Length Limit

The request must have a maximum length.

For example:

```text
MAX_CLAIM_LENGTH=5000
```

The actual value can be adjusted later.

The limit prevents:

- Accidental huge requests
- Memory abuse
- Excessive downstream processing
- Prompt abuse
- Unexpected API costs

---

# 19. Empty Claim Handling

Reject:

```json
{
  "claim": ""
}
```

Also reject whitespace-only input:

```json
{
  "claim": "     "
}
```

Return a structured client error.

---

# 20. Example Validation Error

Example response:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Claim must not be empty."
  }
}
```

Do not expose internal stack traces.

---

# 21. API Response Contract

Use a predictable response structure.

Success:

```json
{
  "success": true,
  "data": {
    "claim": "NASA confirms Earth will experience three days of darkness.",
    "verdict": "UNVERIFIED",
    "confidence": 0,
    "sources": [],
    "explanation": "Verification engine not enabled in Phase 4."
  }
}
```

This is a stub.

Later phases will replace:

```text
UNVERIFIED
```

with actual verification results.

---

# 22. Verdict Taxonomy

The eventual project needs consistent verdict categories.

A possible taxonomy is:

```text
SUPPORTED
FALSE
MISLEADING
UNVERIFIED
```

Phase 4 does not determine the verdict.

It only establishes the response format.

---

# 23. Confidence

The response structure may include:

```text
confidence
```

But Phase 4 should not pretend that a stub confidence value is meaningful.

For example:

```json
"confidence": 0
```

or:

```json
"confidence": null
```

A real confidence score will be produced only after evidence retrieval and reasoning are implemented.

---

# 24. Sources

The response should already reserve a place for:

```json
"sources": []
```

Future phases can populate it:

```json
"sources": [
  {
    "title": "...",
    "url": "...",
    "publisher": "...",
    "publishedAt": "..."
  }
]
```

This makes the API contract forward-compatible.

---

# 25. Explanation

The eventual result should include:

```text
explanation
```

Phase 4 can return:

```text
Verification engine not enabled in Phase 4.
```

Later, this will contain an evidence-grounded explanation.

---

# 26. Request ID

Introduce a unique request ID.

Example:

```text
X-Request-ID: 9d9b0c...
```

If the client does not provide one, the gateway should generate it.

Every log entry associated with that request should include the same ID.

This makes debugging much easier.

---

# 27. Example Request Flow

```text
Extension
   │
   │ POST /api/verify
   │ X-Request-ID: abc123
   ▼
Express
   │
   ▼
Request ID middleware
   │
   ▼
Logging middleware
   │
   ▼
CORS
   │
   ▼
Validation
   │
   ▼
Verification Controller
   │
   ▼
Stub Verification Service
   │
   ▼
Structured Response
   │
   ▼
Extension
```

---

# 28. Controller Layer

The controller should remain thin.

Conceptually:

```text
verifyController
       ↓
Read validated request
       ↓
Call verification service
       ↓
Return response
```

Do not put all verification logic inside the route handler.

---

# 29. Service Layer

Create:

```text
verification.service.ts
```

For Phase 4:

```text
verifyClaim()
      ↓
Return stub result
```

Later:

```text
verifyClaim()
      ↓
Normalize
      ↓
Hash
      ↓
Redis
      ↓
Fact Check API
      ↓
AI service
```

This prevents the route from becoming a massive function.

---

# 30. Routing Layer

Create:

```text
health.routes.ts
verify.routes.ts
```

Conceptually:

```text
/api/health
/api/verify
```

Later:

```text
/api/verify
/api/claims
/api/metrics
/api/admin
```

can be added without restructuring the application.

---

# 31. CORS

The Chrome extension must be able to communicate with the backend.

During development, configure CORS specifically for the extension origin.

Do not simply use:

```text
Access-Control-Allow-Origin: *
```

as the permanent production configuration.

The production policy should explicitly allow the deployed extension origin.

---

# 32. Chrome Extension Origin

The extension origin generally looks like:

```text
chrome-extension://<extension-id>
```

The actual extension ID depends on the loaded/published extension.

Development and production extension IDs may differ.

Therefore, make the allowed origin configurable.

---

# 33. CORS Strategy

Development:

```text
Configured extension origin
```

Production:

```text
Published Chrome extension origin
```

Avoid allowing arbitrary origins.

---

# 34. Body Parsing Limits

Express JSON parsing should have a size limit.

For example:

```text
100kb
```

or another appropriate value.

The backend is receiving text, not screenshots.

Therefore, it should not accept unnecessarily large request bodies.

This is an important architectural boundary:

```text
Image
  → never sent

Text
  → sent
```

---

# 35. Why Small Request Bodies Matter

A malicious client could attempt:

```text
POST /api/verify
Huge JSON payload
```

Without limits, this can consume memory.

A body-size limit provides a basic defense.

---

# 36. Rate Limiting

Full rate limiting is scheduled for Phase 12.

However, Phase 4 should keep the architecture ready for it.

A future structure could be:

```text
Request
 ↓
Rate Limiter
 ↓
Validation
 ↓
Verification
```

Do not implement complex distributed rate limiting yet.

---

# 37. Error Handling

Create one centralized error handler.

All route errors should eventually flow through:

```text
error-handler.ts
```

Example:

```text
Route
 ↓
throw error
 ↓
Central error middleware
 ↓
Structured JSON
```

This prevents inconsistent error responses.

---

# 38. Error Categories

Use predictable categories such as:

```text
INVALID_REQUEST
NOT_FOUND
METHOD_NOT_ALLOWED
INTERNAL_ERROR
SERVICE_UNAVAILABLE
```

Later:

```text
RATE_LIMITED
UPSTREAM_ERROR
AI_SERVICE_ERROR
CACHE_ERROR
```

can be added.

---

# 39. HTTP Status Codes

Use meaningful status codes.

Example:

```text
200 → successful verification request
400 → invalid input
404 → unknown route
405 → unsupported method
413 → request too large
429 → rate limited
500 → internal server error
503 → dependency unavailable
```

Do not return HTTP 200 for every error.

---

# 40. 404 Handling

Unknown routes should return:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found."
  }
}
```

Do not return an HTML Express error page.

The API should consistently return JSON.

---

# 41. Method Handling

For example:

```text
GET /api/verify
```

should not silently behave like:

```text
POST /api/verify
```

Return an appropriate error.

---

# 42. Logging

Use structured logging.

Recommended fields:

```text
timestamp
level
requestId
method
path
statusCode
durationMs
```

Example:

```json
{
  "level": "info",
  "requestId": "abc123",
  "method": "POST",
  "path": "/api/verify",
  "statusCode": 200,
  "durationMs": 12
}
```

Avoid logging the complete claim by default.

Claims may contain sensitive or identifying information.

---

# 43. Privacy-Aware Logging

Do not automatically log:

```text
Full OCR text
Full claim
Entire webpage
Screenshot
User account details
```

Instead, log metadata:

```text
request ID
claim length
hash later
processing time
status
```

Once Phase 5 introduces hashing, the normalized claim hash can become a useful identifier.

---

# 44. Development Logging vs Production Logging

Development may use:

```text
verbose
```

Production should prefer:

```text
info/warn/error
```

and avoid sensitive payload logging.

---

# 45. Request Timing

Measure:

```text
request received
      ↓
processing
      ↓
response sent
```

Store:

```text
durationMs
```

This will later allow comparison between:

```text
Cache hit
Fact-check API
RAG
LLM
```

---

# 46. Backend-to-Extension Contract

Document the API contract explicitly.

### Request

```http
POST /api/verify
Content-Type: application/json
```

```json
{
  "claim": "Example claim"
}
```

### Success

```json
{
  "success": true,
  "data": {
    "claim": "Example claim",
    "verdict": "UNVERIFIED",
    "confidence": 0,
    "explanation": "Verification engine not enabled in Phase 4.",
    "sources": []
  }
}
```

### Failure

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Claim must not be empty."
  }
}
```

---

# 47. API Versioning

For the MVP, use:

```text
/api/...
```

A future production API can move to:

```text
/api/v1/...
```

Do not introduce complicated versioning unless the project actually requires it.

The important thing is to avoid tightly coupling the extension to undocumented backend behavior.

---

# 48. Frontend Integration

At the end of Phase 4, the extension should be able to perform:

```text
OCR
 ↓
User confirmation
 ↓
POST /api/verify
 ↓
Receive JSON
 ↓
Display stub response
```

This proves the complete browser-to-server communication path.

---

# 49. Example Extension Request

Conceptually:

```typescript
const response = await fetch(
  `${API_BASE_URL}/api/verify`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      claim: confirmedClaim
    })
  }
);
```

The API base URL should come from configuration rather than being hard-coded throughout the extension.

---

# 50. Timeout Handling

The extension should not wait forever for the backend.

Define a reasonable request timeout.

Conceptually:

```text
Request
 ↓
Timeout timer
 ↓
Response?
 ├─ Yes → continue
 └─ No → controlled error
```

The exact timeout can be tuned later.

---

# 51. Backend Availability Failure

If the backend is unavailable:

```text
Connection failed
```

the extension should display:

```text
HaCha verification service is temporarily unavailable.
Please try again.
```

Do not expose:

```text
ECONNREFUSED
socket hang up
AxiosError
```

to the user.

---

# 52. Health Check From Development

Test:

```text
Browser
 ↓
http://localhost:<PORT>/api/health
```

Expected:

```json
{
  "success": true,
  "service": "hacha-backend",
  "status": "healthy"
}
```

Then test:

```text
Chrome Extension
 ↓
POST /api/verify
```

---

# 53. API Testing

Use an HTTP testing library such as:

```text
Vitest
```

with a suitable HTTP testing utility.

Test the application without needing to start the production server.

---

# 54. Required API Tests

### Health

```text
GET /api/health
→ 200
```

### Valid claim

```text
POST /api/verify
{
  "claim": "Example"
}

→ 200
```

### Missing claim

```text
{}
→ 400
```

### Empty claim

```text
{
  "claim": ""
}
→ 400
```

### Wrong type

```text
{
  "claim": 123
}
→ 400
```

### Oversized claim

```text
claim > configured maximum
→ 400
```

### Unknown route

```text
GET /api/unknown
→ 404
```

---

# 55. CORS Tests

Verify that:

```text
Allowed extension origin
```

can communicate.

Also verify that unauthorized origins do not receive unrestricted access.

CORS should not be treated as authentication; it is only a browser access-control mechanism.

---

# 56. Security Baseline

Add basic HTTP security protections appropriate for an Express API.

For example:

```text
Security-related HTTP headers
```

through a well-established middleware where appropriate.

Do not treat these headers as a replacement for input validation or authentication.

---

# 57. Input Sanitization

The API primarily needs **validation**, not arbitrary destructive sanitization.

Do not modify the claim in Phase 4.

For example:

```text
Original claim
     ↓
Validate
     ↓
Keep text intact
```

Normalization belongs to Phase 5.

This distinction is important because modifying the claim before hashing/searching can affect fact-checking accuracy.

---

# 58. Unicode Support

Claims may contain:

```text
English
Tamil
Malayalam
Hindi
Arabic
Emoji
Accented characters
```

The API should accept valid UTF-8 text.

Do not assume ASCII-only input.

This becomes increasingly important when multilingual OCR is added.

---

# 59. Content-Type Validation

The `/api/verify` endpoint expects:

```text
application/json
```

Requests with unsupported content types should be rejected cleanly.

---

# 60. Duplicate Requests

Phase 4 does not yet implement Redis caching.

Therefore, duplicate requests may execute the stub service twice.

That is acceptable.

Phase 6 will solve this:

```text
Claim
 ↓
Hash
 ↓
Redis
 ↓
Cache hit/miss
```

---

# 61. MongoDB

Do not connect MongoDB yet.

Although MongoDB belongs to the overall architecture, Phase 4 should focus only on the gateway.

Database persistence can be introduced once meaningful claim/verification records exist.

This reduces unnecessary dependencies while the API contract is still changing.

---

# 62. Redis

Do not connect Redis yet.

Phase 6 will introduce:

```text
Normalized claim
 ↓
SHA-256
 ↓
Redis lookup
```

The Phase 4 service should remain independent of Redis.

---

# 63. AI Service

Do not call the Python service yet.

Phase 8 will establish:

```text
Node Gateway
      ↓
Python FastAPI
      ↓
AI verification
```

For now:

```text
Node Gateway
      ↓
Stub verification service
```

---

# 64. Why the Gateway Comes First

The gateway gives HaCha a stable network boundary.

Without it:

```text
Extension
 ↓
Google API
 ↓
AI Service
 ↓
Search API
```

would create a tightly coupled client.

With the gateway:

```text
Extension
 ↓
One API
 ↓
Gateway decides what happens
```

This allows backend architecture to evolve without constantly updating the extension.

---

# 65. Phase 4 Demonstration

A good Phase 4 demo:

```text
1. Run backend
2. Open /api/health
3. Show healthy response
4. Open HaCha extension
5. Select claim
6. OCR locally
7. Confirm text
8. Click Verify
9. Request reaches Node.js
10. Gateway validates request
11. Stub response returns
12. Extension displays result
```

Example:

```text
HaCha
────────────────────────
Claim received

Verdict:
UNVERIFIED

Explanation:
Verification engine not enabled in Phase 4.

Sources:
None
```

---

# 66. Phase 4 End-to-End Architecture

```text
┌───────────────────────┐
│      WEBPAGE          │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Chrome Extension      │
│                       │
│ Selection             │
│ Local OCR             │
│ User Confirmation     │
└───────────┬───────────┘
            │
            │ HTTPS/HTTP
            │ JSON text only
            ▼
┌───────────────────────┐
│ Node.js + Express     │
│                       │
│ CORS                  │
│ Validation            │
│ Logging               │
│ Error Handling        │
│ Verification Service  │
└───────────┬───────────┘
            │
            ▼
       Stub Result
```

---

# 67. Phase 4 Exit Criteria

Phase 4 is complete only when:

- [ ] Node.js backend starts successfully.
- [ ] TypeScript compiles without errors.
- [ ] Environment configuration is validated.
- [ ] `.env.example` exists.
- [ ] Secrets are excluded from Git.
- [ ] Express application is initialized.
- [ ] `GET /api/health` works.
- [ ] `POST /api/verify` works.
- [ ] Request schema validation works.
- [ ] Empty claims are rejected.
- [ ] Invalid claim types are rejected.
- [ ] Oversized claims are rejected.
- [ ] JSON content type is enforced appropriately.
- [ ] API returns consistent JSON responses.
- [ ] HTTP status codes are meaningful.
- [ ] Unknown routes return structured 404 errors.
- [ ] Centralized error handling exists.
- [ ] Request IDs are generated or propagated.
- [ ] Structured logging exists.
- [ ] Sensitive claim content is not unnecessarily logged.
- [ ] Request duration is measured.
- [ ] CORS is restricted to configured origins.
- [ ] Extension can communicate with the backend.
- [ ] Backend returns a stub verification result.
- [ ] Backend tests pass.
- [ ] No Redis/MongoDB/AI-service dependency is required yet.
- [ ] API contract is documented.

---

# 68. Definition of Done

The Phase 4 definition of done is:

```text
Chrome Extension
      ↓
Confirmed OCR text
      ↓
POST /api/verify
      ↓
Node.js Gateway
      ↓
Validation
      ↓
Verification Service
      ↓
Structured JSON
      ↓
Chrome Extension
```

The request should contain **text only**, not the screenshot.

---

# 69. Suggested Git Commits

Keep Phase 4 development separated:

```text
feat(backend): initialize express typescript service

feat(backend): add environment configuration

feat(backend): add health endpoint

feat(backend): add verify endpoint

feat(backend): add request validation

feat(backend): add structured error handling

feat(backend): add request id middleware

feat(backend): add structured logging

feat(backend): configure extension cors

feat(backend): add stub verification service

feat(extension): connect confirmed claims to backend

test(backend): add health endpoint tests

test(backend): add verification validation tests

test(backend): add error response tests

docs(backend): document API contract
```

---

# 70. Phase 4 Deliverables

At the end of Phase 4:

```text
backend/
│
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── routes/
│   │   ├── health.routes.ts
│   │   └── verify.routes.ts
│   │
│   ├── controllers/
│   │   ├── health.controller.ts
│   │   └── verify.controller.ts
│   │
│   ├── schemas/
│   │   └── verify.schema.ts
│   │
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   ├── request-id.ts
│   │   └── not-found.ts
│   │
│   ├── services/
│   │   └── verification.service.ts
│   │
│   ├── types/
│   │   └── api.ts
│   │
│   └── utils/
│       └── logger.ts
│
├── tests/
│   ├── health.test.ts
│   └── verify.test.ts
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

The exact file structure may vary, but the separation of concerns should remain.

---

# 71. Recommended Development Order

Implement Phase 4 in this order:

```text
Step 1
Initialize Node.js + TypeScript
        ↓
Step 2
Install Express and validation/logging dependencies
        ↓
Step 3
Create app.ts and server.ts
        ↓
Step 4
Create environment configuration
        ↓
Step 5
Add JSON/body limits
        ↓
Step 6
Add CORS
        ↓
Step 7
Add request ID
        ↓
Step 8
Add structured logging
        ↓
Step 9
Create /api/health
        ↓
Step 10
Create /api/verify
        ↓
Step 11
Add Zod request validation
        ↓
Step 12
Create verification service stub
        ↓
Step 13
Add centralized errors
        ↓
Step 14
Connect Chrome extension
        ↓
Step 15
Write API tests
        ↓
Step 16
Verify privacy/network behavior
        ↓
Step 17
Phase 4 exit validation
```

---

# 72. Important Technical Decision

Keep the backend as a **gateway**, not as the AI engine.

The architecture should remain:

```text
Chrome Extension
       ↓
Node.js Gateway
       ↓
Verification components
```

rather than:

```text
Chrome Extension
       ↓
Huge Node.js application containing everything
```

The future Python AI service should remain independently deployable.

---

# 73. Important Product Decision

The extension should know only one primary backend contract:

```text
POST /api/verify
```

It should not directly know about:

```text
Google Fact Check API
Redis
MongoDB
Search provider
LLM
RAG
Python service
```

The gateway hides those implementation details.

This is critical for future maintainability.

---

# 74. Phase 4 → Phase 5 Handoff

Phase 4 currently receives:

```json
{
  "claim": "NASA confirms Earth will experience three days of darkness."
}
```

Phase 5 will transform it:

```text
Raw OCR/User-confirmed text
        ↓
Normalization
        ↓
Noise reduction
        ↓
Entity extraction
        ↓
Number/date preservation
        ↓
Canonical claim
        ↓
SHA-256
```

Example conceptual output:

```json
{
  "originalClaim": "NASA confirms Earth will experience three days of darkness.",
  "normalizedClaim": "nasa confirms earth will experience three days of darkness",
  "hash": "..."
}
```

That hash becomes the foundation for the Phase 6 Redis cache.

---

# 75. Final Phase 4 Summary

Phase 4 creates HaCha's **server-side gateway boundary**.

The architecture now becomes:

```text
               BROWSER
────────────────────────────────
Selection
   ↓
Local OCR
   ↓
Human Confirmation
   ↓
Confirmed Claim
────────────────────────────────
                │
                │ Network boundary
                ▼
               SERVER
────────────────────────────────
Node.js Gateway
   ↓
Validation
   ↓
Logging
   ↓
Error Handling
   ↓
Verification Service
────────────────────────────────
```

The project has now progressed from:

```text
Phase 1
"HaCha can activate."
        ↓
Phase 2
"HaCha can select content."
        ↓
Phase 3
"HaCha can read it locally."
        ↓
Phase 4
"HaCha can securely send the confirmed text
to its backend gateway."
```

The next phase is **Phase 5 — Claim Normalization & Hashing**, where the raw OCR/user-confirmed claim becomes a deterministic canonical representation. This is the foundation for the viral-claim caching system in Phase 6.
