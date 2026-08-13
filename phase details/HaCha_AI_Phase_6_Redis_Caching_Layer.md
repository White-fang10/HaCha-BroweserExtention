# HaCha AI Fact Checker
## Phase 6 — Redis Caching Layer

> **Phase objective:** Introduce Redis as HaCha's high-speed claim cache. Every normalized claim from Phase 5 receives a deterministic SHA-256 identity. Phase 6 uses that identity to check whether the claim has already been verified, returning cached results immediately when possible and storing fresh verification results for future users.

---

## 1. Phase Overview

Phase 5 established:

```text
Raw Claim
    ↓
Normalization
    ↓
Canonical Claim
    ↓
SHA-256
    ↓
Claim Hash
```

Phase 6 turns that hash into a practical caching system:

```text
Confirmed Claim
      ↓
Normalize
      ↓
SHA-256
      ↓
Redis GET
      │
      ├──────── HIT ────────→ Cached Verdict
      │
      └──────── MISS ───────→ Verification
                                  ↓
                              Fresh Result
                                  ↓
                              Redis SET
                                  ↓
                               Response
```

The core principle is:

> **Verify a claim once whenever possible, then serve repeated checks from Redis instead of repeatedly invoking expensive verification systems.**

---

## 2. Why Redis Is Critical

Suppose a false claim becomes viral and 100,000 users check it.

### Without caching

```text
100,000 requests
      ↓
100,000 verification attempts
      ↓
Search/API/LLM usage
      ↓
High latency + high cost
```

### With caching

```text
First request
      ↓
CACHE MISS
      ↓
Verification
      ↓
Redis SET

Next 99,999 requests
      ↓
CACHE HIT
      ↓
Return cached result
```

This protects:

- Fact-check API quotas
- Search API quotas
- LLM inference
- GPU/CPU resources
- Network bandwidth
- Response latency
- Operating cost

---

## 3. Phase 6 Goals

By the end of this phase:

- Redis runs locally.
- Node.js connects to Redis.
- Redis connection lifecycle is handled correctly.
- Phase 5 claim hashes are used as cache identities.
- Cache keys follow a documented naming convention.
- Verification results can be stored.
- Verification results can be retrieved.
- Cache hits bypass verification.
- Cache misses continue to verification.
- TTL behavior works.
- Cached data is schema-validated.
- Redis failures are handled gracefully.
- Cache hit/miss metrics are recorded.
- Cache latency is measured.
- Concurrent-request behavior is tested.
- The system is ready for Phase 7.

---

## 4. What Phase 6 Does NOT Implement

Do not implement yet:

```text
❌ Google Fact Check API
❌ Search APIs
❌ RAG
❌ LLM inference
❌ Python AI service
❌ Evidence ranking
❌ MongoDB analytics
❌ Production Redis cluster
❌ Semantic cache matching
```

Phase 6 uses the Phase 4 stub verification service to prove that caching works.

---

## 5. Architecture

```text
                    Chrome Extension
                           │
                           ▼
                    Node.js Gateway
                           │
                           ▼
                  Claim Normalization
                           │
                           ▼
                       SHA-256
                           │
                           ▼
                    ┌────────────┐
                    │   Redis    │
                    └─────┬──────┘
                          │
                ┌─────────┴─────────┐
                │                   │
               HIT                 MISS
                │                   │
                ▼                   ▼
         Cached Result       Verification Service
                │                   │
                │                   ▼
                │              Fresh Result
                │                   │
                │                   ▼
                │                 Redis
                │                   │
                └─────────┬─────────┘
                          ▼
                     Extension
```

---

## 6. Recommended Backend Structure

Extend the Phase 5 backend:

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
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   ├── request-id.ts
│   │   └── not-found.ts
│   │
│   ├── services/
│   │   ├── verification.service.ts
│   │   │
│   │   ├── claim/
│   │   │   ├── claim-normalizer.ts
│   │   │   └── claim-hasher.ts
│   │   │
│   │   └── cache/
│   │       ├── redis.client.ts
│   │       ├── redis-cache.service.ts
│   │       └── cache-key.ts
│   │
│   ├── schemas/
│   │   └── verify.schema.ts
│   │
│   ├── types/
│   │   ├── api.ts
│   │   ├── claim.ts
│   │   └── cache.ts
│   │
│   └── utils/
│       └── logger.ts
│
├── tests/
│   ├── health.test.ts
│   ├── verify.test.ts
│   └── cache/
│       ├── redis-cache.test.ts
│       └── cache-key.test.ts
│
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

Keep Redis access isolated from the verification business logic.

---

## 7. Local Redis

Use Docker for development.

Conceptually:

```text
Docker Compose
      │
      └── Redis
```

This lets you test the entire caching architecture locally before paying for hosted infrastructure.

---

## 8. Environment Configuration

Extend `.env.example`:

```env
NODE_ENV=development
PORT=4000

REDIS_URL=redis://localhost:6379

CACHE_TTL_SECONDS=86400
CACHE_KEY_PREFIX=hacha:claim
CACHE_SCHEMA_VERSION=v1
CACHE_ENABLED=true
```

Do not commit real credentials.

---

## 9. Redis Connection Lifecycle

Use one reusable Redis connection:

```text
Application starts
       ↓
Create Redis client
       ↓
Connect
       ↓
Reuse connection
       ↓
Application shuts down
       ↓
Close connection
```

Do **not** create and destroy a Redis client for every request.

---

## 10. Redis Health

The backend can expose dependency status:

```json
{
  "success": true,
  "service": "hacha-backend",
  "status": "healthy",
  "dependencies": {
    "redis": "healthy"
  }
}
```

Redis being unavailable should be distinguished from the application itself being unavailable.

---

## 11. Cache Key Design

Use a structured key:

```text
hacha:claim:v1:<sha256>
```

For example:

```text
hacha:claim:v1:a3f91c...
```

Components:

```text
hacha
  ↓
application namespace

claim
  ↓
data type

v1
  ↓
cache/normalization version

sha256
  ↓
claim identity
```

---

## 12. Why Version the Key?

Normalization rules may change.

Current:

```text
hacha:claim:v1:<hash>
```

Future:

```text
hacha:claim:v2:<hash>
```

Versioning makes migrations and cache invalidation much easier.

---

## 13. Cache Value Schema

Store a structured JSON object.

Example:

```json
{
  "schemaVersion": "v1",
  "claimHash": "a3f91c...",
  "normalizedClaim": "nasa confirms earth will experience three days of darkness",
  "verdict": "FALSE",
  "confidence": 0.98,
  "explanation": "No credible evidence supports the claim.",
  "sources": [],
  "createdAt": "2026-08-12T10:00:00.000Z",
  "expiresAt": "2026-08-13T10:00:00.000Z"
}
```

The exact verification fields will evolve in Phase 7 onward.

---

## 14. Why Store the Hash Inside the Value?

Although the hash is already part of the key, storing it in the value helps detect:

- Incorrect keys
- Corrupted entries
- Unexpected data
- Debugging/migration issues

---

## 15. Cache Privacy

Redis should never be directly exposed to the internet.

Production architecture:

```text
Internet
   ↓
Backend
   ↓
Private network
   ↓
Redis
```

Claims can contain sensitive information, so:

- Do not log full cached values.
- Use reasonable TTLs.
- Restrict Redis network access.
- Consider encryption at rest in production.
- Avoid storing more information than necessary.

---

## 16. TTL Strategy

Every cache entry should expire.

Example:

```env
CACHE_TTL_SECONDS=86400
```

This represents 24 hours.

The value is only an initial default.

---

## 17. Why TTL Matters

Facts can change.

Examples:

```text
Breaking news
Election results
Prices
Weather
Ongoing events
New scientific findings
```

A permanent cache could serve stale information.

Therefore:

```text
Redis cache
    ≠
Permanent source of truth
```

---

## 18. Future Dynamic TTL

Eventually TTL can depend on claim type:

```text
Stable historical fact
      ↓
Longer TTL

Breaking news
      ↓
Short TTL

Ongoing event
      ↓
Very short TTL
```

Phase 6 should start with a configurable fixed TTL.

---

## 19. Cache-Aside Pattern

HaCha should use the cache-aside pattern:

```text
Application
    ↓
Check Redis
    ↓
MISS
    ↓
Verification
    ↓
Write result to Redis
    ↓
Return result
```

Redis accelerates the application but is not the source of truth.

---

## 20. Cache HIT Flow

```text
POST /api/verify
        ↓
Validate
        ↓
Normalize
        ↓
Hash
        ↓
Redis GET
        ↓
HIT
        ↓
Validate cached value
        ↓
Return cached result
```

No expensive verification should occur after a valid cache hit.

---

## 21. Cache MISS Flow

```text
POST /api/verify
        ↓
Validate
        ↓
Normalize
        ↓
Hash
        ↓
Redis GET
        ↓
MISS
        ↓
Verification Service
        ↓
Fresh result
        ↓
Redis SET + TTL
        ↓
Return response
```

Phase 6 uses the stub verifier.

Phase 7 will introduce a real fact-check provider.

---

## 22. Cache Service Abstraction

Use a dedicated service:

```typescript
interface CacheService {
  getClaim(hash: string): Promise<CachedVerification | null>;

  setClaim(
    hash: string,
    result: CachedVerification,
    ttlSeconds: number
  ): Promise<void>;

  deleteClaim?(hash: string): Promise<void>;
}
```

The verification service should not contain raw Redis commands.

---

## 23. Serialization

Redis stores strings/bytes.

Therefore:

```text
Object
  ↓
JSON.stringify()
  ↓
Redis
```

and:

```text
Redis
  ↓
JSON.parse()
  ↓
Object
```

The parsed object must be schema-validated before use.

---

## 24. Invalid Cache Data

If Redis contains:

```text
"{broken json"
```

do not crash the server.

Instead:

```text
GET
 ↓
Parse failure
 ↓
Treat as cache miss
 ↓
Fresh verification
```

Optionally delete the invalid key.

---

## 25. Cached Result Schema Validation

Do not trust Redis data blindly.

Use a schema:

```text
Redis value
    ↓
JSON.parse
    ↓
Schema validation
    ↓
Valid?
 ├─ YES → HIT
 └─ NO  → MISS/invalidate
```

This protects against stale or malformed data.

---

## 26. Cache Hit Metadata

Internally track:

```json
{
  "cacheHit": true
}
```

or:

```json
{
  "cacheHit": false
}
```

This is useful for evaluation.

The development API may expose:

```json
"meta": {
  "cacheHit": true
}
```

---

## 27. Cache Latency

Measure:

```text
cacheLookupTimeMs
cacheWriteTimeMs
```

The key comparison is:

```text
Cache hit latency
        vs
Fresh verification latency
```

---

## 28. Viral Cache Demonstration

### Request 1

```text
Claim
 ↓
Normalize
 ↓
Hash
 ↓
Redis MISS
 ↓
Stub verification
 ↓
Redis SET
 ↓
Response
```

### Request 2

```text
Same claim
 ↓
Same normalized text
 ↓
Same hash
 ↓
Redis HIT
 ↓
Cached response
```

Then measure:

```text
First request:  X ms
Second request: Y ms
```

The actual numbers should come from your local benchmark.

---

## 29. Cache Hit Ratio

Track:

```text
cacheHits
cacheMisses
```

Calculate:

```text
hitRatio =
cacheHits / (cacheHits + cacheMisses)
```

Example:

```text
Hits:   900
Misses: 100

Hit ratio = 90%
```

This becomes an important Phase 13 metric.

---

## 30. Why Hit Ratio Matters

If 10,000 users make requests and the cache hit ratio is 90%:

```text
9,000 requests
```

can avoid the expensive verification pipeline.

This can significantly reduce:

- API usage
- Search calls
- LLM calls
- GPU inference
- Latency

---

## 31. Cache Miss Is Not an Error

A cache miss means:

```text
No cached result exists.
```

It does not mean Redis failed.

Therefore:

```text
MISS
 ↓
Normal application flow
```

while:

```text
Redis unavailable
 ↓
Infrastructure problem
```

are separate states.

---

## 32. Redis Failure Strategy

The backend should preferably degrade gracefully.

If Redis is temporarily unavailable:

```text
Request
 ↓
Normalization
 ↓
Redis unavailable
 ↓
Continue verification
```

if the verification service is available.

The application should not automatically collapse because the optional acceleration layer is unavailable.

---

## 33. Cache-aside Resilience

Redis should accelerate the system:

```text
Redis available
 ↓
Fast path
```

and when unavailable:

```text
Redis unavailable
 ↓
Fallback to normal verification
```

This is preferable to making Redis a hard dependency for every request.

---

## 34. Cache Stampede Problem

Imagine 10,000 users check a new viral claim at nearly the same time.

All requests could do:

```text
Redis GET
 ↓
MISS
```

and all start verification.

That creates:

```text
10,000 verification calls
```

even though only one result is needed.

This is the:

> **Cache stampede / thundering herd problem.**

Phase 6 must test and document this risk.

---

## 35. Future Stampede Protection

A future strategy can use a short Redis lock:

```text
hacha:lock:v1:<sha256>
```

Flow:

```text
Request A
 ↓
Acquire lock
 ↓
Verify
 ↓
SET cache
 ↓
Release lock

Requests B/C/D
 ↓
See lock
 ↓
Wait briefly / retry cache
```

Do not make distributed locking the first feature implemented.

---

## 36. Cache Poisoning

The client must never be able to write arbitrary verdicts into Redis.

Bad:

```text
Extension
 ↓
POST /cache
 ↓
Redis SET
```

Good:

```text
Extension
 ↓
POST /verify
 ↓
Trusted verification pipeline
 ↓
Validated result
 ↓
Redis SET
```

Only trusted backend code writes verification results.

---

## 37. Redis vs MongoDB

Keep responsibilities separate:

| System | Responsibility |
|---|---|
| Redis | Fast temporary cache |
| MongoDB | Long-term records and analytics |
| Fact-check API | External fact-check evidence |
| AI service | Retrieval/reasoning |
| Extension | User interaction |

Do not replace MongoDB with Redis for permanent storage.

---

## 38. Cache Response Contract

Cached and fresh results should use the same API shape.

### Fresh

```json
{
  "success": true,
  "data": {
    "claim": "Example claim",
    "verdict": "FALSE",
    "confidence": 0.98,
    "explanation": "Example explanation.",
    "sources": []
  },
  "meta": {
    "cacheHit": false
  }
}
```

### Cached

```json
{
  "success": true,
  "data": {
    "claim": "Example claim",
    "verdict": "FALSE",
    "confidence": 0.98,
    "explanation": "Example explanation.",
    "sources": []
  },
  "meta": {
    "cacheHit": true
  }
}
```

The frontend should not need two completely different rendering systems.

---

## 39. Cache Freshness Metadata

Store:

```text
createdAt
expiresAt
```

This can later support UI information such as:

```text
Verified 3 hours ago
```

or:

```text
Cached result
```

Freshness becomes more important once real sources are introduced.

---

## 40. Fixed vs Sliding TTL

Two common policies:

### Fixed TTL

```text
Created
 ↓
TTL starts
 ↓
Expires
```

### Sliding TTL

```text
Cache hit
 ↓
TTL extended
```

For factual verification, start with fixed TTL because it makes evidence freshness easier to reason about.

---

## 41. Cache Invalidation

For Phase 6, expiration is the primary invalidation mechanism:

```text
TTL expires
 ↓
Entry disappears
```

Later, manual invalidation can be introduced when an external fact-check source changes its rating.

---

## 42. Developer Invalidation

A developer-only function may be useful:

```typescript
invalidateClaim(hash)
```

This helps testing and debugging.

Never expose unrestricted cache deletion to anonymous clients.

---

## 43. Redis Security

Production Redis should:

- Not be publicly reachable.
- Use authentication where supported.
- Use TLS where appropriate.
- Be restricted to backend services.
- Have appropriate memory limits.
- Have controlled persistence configuration.
- Be monitored.

Local development can remain simple.

---

## 44. Connection Retry

Use the Redis client's supported reconnect behavior with controlled backoff.

Avoid aggressive infinite retry loops.

The application should remain responsive during Redis outages.

---

## 45. Request Timeout

Redis calls should not hang forever.

Configure reasonable client/network timeouts.

A cache is an optimization; it should not create a permanent request bottleneck.

---

## 46. Logging

Recommended structured events:

```text
cache_lookup
cache_hit
cache_miss
cache_set
cache_invalid_entry
cache_error
```

Example:

```json
{
  "level": "info",
  "requestId": "abc123",
  "event": "cache_hit",
  "claimHash": "a3f9...",
  "lookupDurationMs": 2
}
```

Do not log the full claim by default.

---

## 47. Metrics

Track:

```text
cacheHits
cacheMisses
cacheErrors
cacheSetSuccess
cacheSetFailures
cacheLookupLatency
cacheWriteLatency
```

These metrics will later support the project's evaluation report.

---

## 48. Testing Strategy

Use:

```text
Unit tests
Integration tests
End-to-end tests
```

### Unit tests

Test:

- Cache key generation
- Serialization
- Deserialization
- Schema validation
- TTL configuration

### Integration tests

Test against real local Redis:

- GET
- SET
- TTL
- DELETE
- Invalid values

### API tests

Test:

- First request → MISS
- Second request → HIT
- Different claim → different cache entry
- Expired entry → MISS

---

## 49. Most Important Test

This test proves the entire Phase 6 concept:

```text
First request
    ↓
CACHE MISS
    ↓
verification service called once
    ↓
result cached

Second request
    ↓
CACHE HIT
    ↓
verification service NOT called again
```

If this test passes, the basic viral-cache architecture is working.

---

## 50. TTL Test

Use a very short test TTL:

```text
2 seconds
```

Then:

```text
SET
 ↓
GET → HIT
 ↓
Wait
 ↓
GET → MISS
```

This confirms expiration.

---

## 51. Invalid Cache Test

Insert malformed JSON:

```text
hacha:claim:v1:test
```

Then request it.

Expected:

```text
Parse error
 ↓
Treat as MISS
 ↓
Fresh verification
```

The backend must remain operational.

---

## 52. Redis Failure Test

Stop Redis temporarily.

Then send:

```text
POST /api/verify
```

Verify that the chosen fallback policy works.

Recommended MVP behavior:

```text
Redis unavailable
 ↓
Log error
 ↓
Continue to verification
```

---

## 53. Concurrent Request Test

Simulate:

```text
100 requests
same claim
same time
```

Measure:

```text
verification calls
cache hits
cache misses
```

This will show whether the application experiences a cache stampede.

---

## 54. Performance Evaluation

Record:

```text
Redis GET latency
Redis SET latency
Cache-hit request latency
Cache-miss request latency
Average latency
p50 latency
p95 latency
Cache hit ratio
```

Later compare this with:

```text
Fact-check API latency
RAG latency
LLM latency
```

---

## 55. Cost Evaluation

A useful theoretical model:

```text
Total requests = N
Cache hit ratio = H

Approximate verification requests:

N × (1 - H)
```

For example:

```text
N = 10,000
H = 0.90

Verification requests ≈ 1,000
```

This is the economic argument for the cache.

---

## 56. Phase 6 Demonstration

Use one claim repeatedly.

### First request

```text
Claim
 ↓
Normalize
 ↓
Hash
 ↓
Redis MISS
 ↓
Stub verification
 ↓
Redis SET
```

Show:

```text
CACHE MISS
```

### Second request

```text
Same claim
 ↓
Same hash
 ↓
Redis HIT
 ↓
Cached result
```

Show:

```text
CACHE HIT
```

Then show the latency difference.

---

## 57. Phase 6 Exit Criteria

Phase 6 is complete when:

- [ ] Redis runs locally.
- [ ] Node.js connects to Redis.
- [ ] Redis connection is reused.
- [ ] Redis shutdown is handled.
- [ ] Redis URL is environment-configured.
- [ ] Cache TTL is configurable.
- [ ] Cache key prefix is configurable.
- [ ] Cache schema version exists.
- [ ] Phase 5 claim hash is used as the cache identity.
- [ ] Cache key format is documented.
- [ ] Verification results are serialized safely.
- [ ] Cached values are schema-validated.
- [ ] Cache GET works.
- [ ] Cache SET works.
- [ ] TTL expiration works.
- [ ] Cache HIT bypasses verification.
- [ ] Cache MISS invokes verification.
- [ ] Fresh results are cached.
- [ ] Invalid cache data is handled.
- [ ] Redis errors are handled gracefully.
- [ ] Cache failures do not unnecessarily crash the gateway.
- [ ] Hit/miss metrics are recorded.
- [ ] Cache latency is measured.
- [ ] Cached/fresh API response schemas are consistent.
- [ ] Client cannot directly poison the cache.
- [ ] Concurrent behavior is tested.
- [ ] Cache stampede risk is documented.
- [ ] Integration tests pass.
- [ ] Viral-claim cache demonstration works.

---

## 58. Definition of Done

```text
User
 ↓
Select claim
 ↓
Local OCR
 ↓
Confirm
 ↓
Backend
 ↓
Normalize
 ↓
SHA-256
 ↓
Redis GET
 ├──────── HIT ────────→ Cached Result
 │
 └──────── MISS
                ↓
          Verification
                ↓
             Redis SET
                ↓
             Result
```

The critical requirement is:

```text
CACHE HIT
     ↓
NO EXPENSIVE VERIFICATION
```

---

## 59. Suggested Git Commits

```text
feat(backend): add redis client
feat(backend): add redis environment configuration
feat(backend): add cache key generator
feat(backend): add claim cache service
feat(backend): add cached result schema
feat(backend): add cache get operation
feat(backend): add cache set with ttl
feat(backend): integrate redis with verification service
feat(backend): add cache hit metadata
feat(backend): add cache metrics
feat(backend): add graceful redis failure handling
test(backend): add redis cache integration tests
test(backend): add cache expiration tests
test(backend): add cache hit and miss tests
test(backend): add invalid cache data tests
test(backend): add concurrent cache tests
docs(backend): document redis caching architecture
```

---

## 60. Recommended Development Order

```text
Step 1
Run Redis locally
        ↓
Step 2
Install/configure Redis client
        ↓
Step 3
Configure REDIS_URL
        ↓
Step 4
Create reusable Redis connection
        ↓
Step 5
Test connection
        ↓
Step 6
Create cache-key generator
        ↓
Step 7
Create cached-result schema
        ↓
Step 8
Create cache service
        ↓
Step 9
Implement GET
        ↓
Step 10
Implement SET + TTL
        ↓
Step 11
Integrate with verification service
        ↓
Step 12
Test first request → MISS
        ↓
Step 13
Test second request → HIT
        ↓
Step 14
Test TTL expiration
        ↓
Step 15
Test malformed cache data
        ↓
Step 16
Test Redis failure
        ↓
Step 17
Measure latency
        ↓
Step 18
Test concurrent requests
        ↓
Step 19
Add cache metrics
        ↓
Step 20
Phase 6 exit validation
```

---

## 61. Important Technical Decision

Use **cache-aside** rather than treating Redis as the source of truth.

```text
Verification system
       ↓
Validated result
       ↓
Redis cache
```

If Redis disappears:

```text
Redis lost
 ↓
Verification can happen again
 ↓
Cache rebuilt
```

This makes the system resilient.

---

## 62. Important Product Decision

Never cache an unverified guess.

Bad:

```text
Claim
 ↓
Temporary guess
 ↓
Redis
```

Good:

```text
Claim
 ↓
Reliable verification
 ↓
Validated result
 ↓
Redis
```

Phase 6 uses the stub verifier only to prove infrastructure behavior.

---

## 63. Phase 6 → Phase 7 Handoff

Phase 6 provides:

```text
Claim
 ↓
Normalization
 ↓
SHA-256
 ↓
Redis
```

Phase 7 introduces the first real verification provider:

```text
Redis GET
   │
   ├── HIT → Return cached result
   │
   └── MISS
          ↓
    Google Fact Check Tools API
          ↓
    Existing fact-check?
       │
       ├── YES
       │    ↓
       │  Map external rating
       │    ↓
       │  Redis SET
       │    ↓
       │  Return
       │
       └── NO
            ↓
       Continue toward
       evidence/RAG pipeline
```

This is the first point where HaCha's cache will contain real fact-check results.

---

## 64. Final Phase 6 Summary

Phase 6 creates HaCha's **high-speed viral claim memory**.

The project now progresses:

```text
Phase 1
Extension activation
        ↓
Phase 2
Region selection
        ↓
Phase 3
Local OCR
        ↓
Phase 4
Backend gateway
        ↓
Phase 5
Claim normalization + SHA-256
        ↓
Phase 6
Redis claim cache
```

Complete flow:

```text
                  USER
                    │
                    ▼
              Selects Claim
                    │
                    ▼
               Local OCR
                    │
                    ▼
            Human Confirmation
                    │
                    ▼
              Node Gateway
                    │
                    ▼
             Normalize Claim
                    │
                    ▼
                SHA-256
                    │
                    ▼
              ┌───────────┐
              │   Redis   │
              └─────┬─────┘
                    │
             ┌──────┴──────┐
             │             │
            HIT           MISS
             │             │
             ▼             ▼
       Cached Result   Verification
             │             │
             │             ▼
             │        Fresh Result
             │             │
             │             ▼
             │           Redis
             │             │
             └──────┬──────┘
                    ▼
                Response
                    │
                    ▼
               Chrome UI
```

The central principle is:

> **Verify once, cache the evidence-backed result, and serve repeated checks at memory speed.**

At the end of Phase 6, HaCha has moved beyond a browser OCR prototype into a real **claim identity + high-speed caching architecture**.

The next phase is **Phase 7 — Fact-Check Database Integration**, where the first real external verification layer will be added and the Redis cache will begin storing actual fact-check results.
