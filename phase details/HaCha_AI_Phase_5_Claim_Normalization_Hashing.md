# HaCha AI Fact Checker
## Phase 5 — Claim Normalization & Hashing

> **Phase objective:** Transform noisy, inconsistent OCR/user-entered claim text into a deterministic canonical representation and generate a SHA-256 identity for that claim. This phase creates the foundation for HaCha's viral-claim cache in Phase 6 while preserving meaningful facts such as names, numbers, dates, percentages, units, and negation.

---

# 1. Phase Overview

By the end of Phase 4, HaCha can send confirmed text to the Node.js gateway:

```text
Chrome Extension
      ↓
Local OCR
      ↓
Human confirmation
      ↓
POST /api/verify
      ↓
Node.js Gateway
```

The problem is that the same claim may arrive in many different forms.

For example:

```text
NASA confirms Earth will experience three days of darkness.
```

could become:

```text
NASA CONFIRMS Earth will experience three days of darkness!!!
```

or:

```text
nasa confirms earth will experience three days of darkness
```

or:

```text
NASA confirms Earth will experience
three days of darkness.
```

or OCR could introduce:

```text
NASA confirms Earth will experience 3 days of darkness.
```

If HaCha hashes these raw strings directly, they produce different hashes.

That would destroy the effectiveness of the viral-claim cache.

Phase 5 therefore introduces:

```text
Raw Claim
    ↓
Cleaning
    ↓
Canonicalization
    ↓
Meaning-preserving normalization
    ↓
Deterministic representation
    ↓
SHA-256
    ↓
Claim Identity
```

---

# 2. Why This Phase Matters

Phase 5 is not merely a text-cleaning feature.

It creates the identity system used by the future cache.

The target behavior is:

```text
Same logical claim
        ↓
Same normalized representation
        ↓
Same SHA-256 hash
        ↓
Same Redis cache entry
```

This enables:

```text
User A checks viral post
        ↓
Verification occurs
        ↓
Result cached

User B checks same claim
        ↓
Same hash
        ↓
Redis HIT
        ↓
Instant result
```

Without reliable normalization, the cache could miss even when millions of users are checking essentially the same claim.

---

# 3. Phase 5 Goals

By the end of this phase:

- Raw claim text is accepted from Phase 4.
- OCR noise is reduced.
- Whitespace is normalized.
- Casing is standardized for the canonical representation.
- Unicode normalization is applied.
- Decorative noise is handled carefully.
- URLs/usernames/hashtags can be identified.
- Numbers are preserved.
- Dates are preserved.
- Percentages are preserved.
- Units are preserved.
- Named entities are preserved.
- Negation is preserved.
- Sentence meaning is not intentionally changed.
- A deterministic normalized claim is produced.
- SHA-256 is generated from the canonical claim.
- Normalization is deterministic.
- Equivalent test inputs can produce the same hash.
- Meaningfully different claims produce different hashes.
- Original and normalized forms can be distinguished.
- Unit tests cover important edge cases.
- The system is ready for Redis integration in Phase 6.

---

# 4. What Phase 5 Does NOT Implement

Do not implement:

```text
❌ Redis
❌ Cache TTL
❌ Google Fact Check API
❌ Search APIs
❌ RAG
❌ LLM reasoning
❌ Verdict generation
❌ Evidence retrieval
❌ AI microservice
❌ MongoDB persistence
```

Phase 5 should focus exclusively on:

```text
Claim → Canonical Claim → Hash
```

---

# 5. Architecture

The backend pipeline becomes:

```text
                POST /api/verify
                       │
                       ▼
                Request Validation
                       │
                       ▼
                Raw Claim Text
                       │
                       ▼
              Normalization Pipeline
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
       Unicode      Whitespace    Noise
      normalization normalization reduction
          │            │            │
          └────────────┼────────────┘
                       ▼
              Entity/Number Handling
                       │
                       ▼
               Canonical Claim
                       │
                       ▼
                   SHA-256
                       │
                       ▼
                Claim Identity
                       │
                       ▼
              Phase 6: Redis
```

---

# 6. Core Design Principle

The most important rule is:

> **Normalize formatting, not meaning.**

Good normalization:

```text
"NASA   CONFIRMS   Earth!!!"
        ↓
"nasa confirms earth"
```

Dangerous normalization:

```text
"NASA confirms Earth is NOT flat."
        ↓
"nasa confirms earth is flat"
```

Never remove words simply because they look like common language.

Words such as:

```text
not
never
no
without
false
fake
denies
```

can completely change the meaning of a claim.

---

# 7. Recommended Backend Structure

Extend the Phase 4 structure:

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
│   ├── services/
│   │   ├── verification.service.ts
│   │   └── claim/
│   │       ├── claim-normalizer.ts
│   │       ├── claim-hasher.ts
│   │       ├── claim-tokenizer.ts
│   │       ├── entity-extractor.ts
│   │       ├── number-preserver.ts
│   │       └── normalization-rules.ts
│   │
│   ├── types/
│   │   ├── api.ts
│   │   └── claim.ts
│   │
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   ├── request-id.ts
│   │   └── not-found.ts
│   │
│   └── utils/
│       ├── logger.ts
│       └── crypto.ts
│
├── tests/
│   ├── health.test.ts
│   ├── verify.test.ts
│   └── claim/
│       ├── normalization.test.ts
│       └── hashing.test.ts
│
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

The exact number of files can be reduced, but claim normalization should remain isolated from the HTTP layer.

---

# 8. Raw vs Normalized vs Hash

Do not treat these as the same thing.

## Raw claim

Exactly what the user/OCR produced:

```text
"NASA CONFIRMS Earth will experience three days of darkness!!!"
```

## Normalized claim

Canonical representation:

```text
"nasa confirms earth will experience three days of darkness"
```

## Hash

Cryptographic identity:

```text
SHA-256(normalizedClaim)
```

These three values have different purposes.

---

# 9. Recommended Data Model

A useful internal representation is:

```typescript
interface NormalizedClaim {
  originalText: string;
  normalizedText: string;
  hash: string;
  normalizationVersion: string;
}
```

Potential future fields:

```text
language
entities
numbers
dates
normalizationWarnings
```

---

# 10. Normalization Version

Introduce a normalization version from the beginning.

Example:

```text
normalizationVersion = "v1"
```

Why?

Because normalization rules may change.

Today:

```text
v1
```

might normalize one claim into:

```text
"nasa confirms earth will experience three days of darkness"
```

A future algorithm could produce something different.

If the algorithm changes without versioning, old Redis keys can become difficult to reason about.

Therefore, conceptually:

```text
v1:<hash>
```

can later become the cache identity.

---

# 11. Normalization Pipeline

Recommended order:

```text
Raw text
   ↓
Unicode normalization
   ↓
Trim
   ↓
Whitespace normalization
   ↓
OCR artifact cleanup
   ↓
Safe punctuation normalization
   ↓
Case normalization
   ↓
URL/entity handling
   ↓
Number/date preservation
   ↓
Final canonicalization
   ↓
SHA-256
```

The order matters.

Do not randomly apply transformations.

---

# 12. Step 1 — Unicode Normalization

Normalize Unicode representations before comparing text.

For example, visually similar characters can have different underlying representations.

Use a consistent Unicode normalization form such as:

```text
NFKC
```

when appropriate.

However, test multilingual text carefully before applying aggressive Unicode transformations.

The system must not corrupt:

```text
Tamil
Malayalam
Hindi
Arabic
etc.
```

---

# 13. Step 2 — Trim Whitespace

Remove unnecessary whitespace at the beginning and end.

Example:

```text
"   NASA confirms Earth   "
```

becomes:

```text
"NASA confirms Earth"
```

---

# 14. Step 3 — Collapse Whitespace

Convert repeated whitespace into a single space.

Example:

```text
"NASA    confirms     Earth"
```

becomes:

```text
"NASA confirms Earth"
```

Also normalize:

```text
newlines
tabs
multiple spaces
```

into consistent separators where appropriate.

---

# 15. Step 4 — OCR Artifact Cleanup

OCR may produce artifacts such as:

```text
"N A S A"
"Earth   will"
"darkness | next"
```

Some OCR corrections may be possible.

However, be conservative.

Do not build a giant automatic spelling correction system in Phase 5.

Incorrect correction can change the claim.

---

# 16. OCR Character Confusion

Common OCR substitutions include:

```text
O ↔ 0
I ↔ 1
S ↔ 5
B ↔ 8
```

Example:

```text
2026
```

might become:

```text
2O26
```

Do not globally replace:

```text
O → 0
```

because legitimate words contain `O`.

Corrections should be context-aware and conservative.

---

# 17. Step 5 — Case Normalization

For the canonical hash representation, convert case consistently.

Example:

```text
NASA Confirms Earth
```

becomes:

```text
nasa confirms earth
```

This helps:

```text
NASA
Nasa
nasa
```

produce the same canonical representation.

However, preserve the original text separately for display and auditing.

---

# 18. Step 6 — Punctuation

Punctuation should be handled carefully.

These may reasonably map to the same canonical form:

```text
"NASA confirms Earth!"
"NASA confirms Earth."
"NASA confirms Earth"
```

Potential canonical result:

```text
nasa confirms earth
```

But punctuation can sometimes affect meaning.

Examples:

```text
"Not true."
```

versus:

```text
"Not, true."
```

Therefore, use conservative punctuation rules.

---

# 19. Repeated Punctuation

Social-media text often contains:

```text
!!!
???
...
```

Repeated decorative punctuation can be reduced.

Example:

```text
"NASA confirms Earth!!!"
```

→

```text
"nasa confirms earth"
```

But do not delete punctuation blindly before evaluating whether it carries semantic meaning.

---

# 20. Emojis

OCR may occasionally produce emoji or nearby decorative characters.

The normalization policy should distinguish:

```text
Decorative emoji
```

from:

```text
Meaningful symbols
```

For the first implementation, decorative emoji can be removed from the canonical claim where appropriate.

But retain the original claim.

---

# 21. Hashtags

Social posts may contain:

```text
#NASA
#BreakingNews
#FactCheck
```

A hashtag can be:

- Core claim content
- Metadata
- Decorative/social context

Do not automatically remove every hashtag.

Instead, identify them.

For example:

```text
Claim:
"NASA confirms Earth will experience darkness #NASA #Breaking"
```

Potential canonical claim:

```text
"nasa confirms earth will experience darkness"
```

with metadata:

```text
hashtags:
["NASA", "Breaking"]
```

The exact policy should be tested.

---

# 22. Usernames

Social media screenshots may contain:

```text
@username
@news_channel
@official_account
```

These are usually attribution metadata rather than claim content.

The normalization pipeline can identify them separately:

```text
mentions:
["@news_channel"]
```

and exclude them from the canonical claim where appropriate.

Do not remove an `@` character if it is genuinely part of a meaningful identifier.

---

# 23. URLs

Claims may contain URLs:

```text
https://example.com/article
```

URLs can be valuable evidence but often create poor cache keys.

Separate:

```text
Claim text
```

from:

```text
Referenced URLs
```

For example:

```json
{
  "normalizedText": "example claim",
  "urls": [
    "https://example.com/article"
  ]
}
```

Whether URLs contribute to the claim hash should be explicitly defined.

For the MVP, the canonical claim can exclude tracking-heavy URL parameters while preserving the URL as metadata.

---

# 24. Tracking Parameters

URLs can contain:

```text
utm_source
utm_medium
utm_campaign
fbclid
gclid
```

These often identify the distribution channel rather than the underlying article.

A future URL normalization layer can remove known tracking parameters.

Do not blindly strip arbitrary query parameters because some URLs rely on them for content identity.

---

# 25. Numbers Are Sacred

Numbers should be treated as high-value information.

Examples:

```text
20%
2.5 million
2026
$500
5 km
-10°C
```

Do not remove or casually normalize them.

The following are different claims:

```text
20%
vs
200%
```

and:

```text
2025
vs
2026
```

The hash system must preserve these differences.

---

# 26. Date Preservation

Dates should be preserved.

Examples:

```text
August 12, 2026
12/08/2026
2026-08-12
```

A future canonical date parser could represent them consistently.

But do not convert ambiguous formats without knowing the intended locale.

For example:

```text
12/08/2026
```

could mean:

```text
12 August
```

or:

```text
December 8
```

depending on locale.

Therefore, date normalization should be conservative.

---

# 27. Percentage Preservation

Keep:

```text
5%
5 percent
5 percentage points
```

distinct until semantic normalization can determine whether they mean the same thing.

Do not blindly map all of them to:

```text
5
```

because:

```text
5%
```

and:

```text
5 percentage points
```

can represent different concepts.

---

# 28. Units

Preserve units:

```text
5 km
5 miles
100 kg
100 lb
30°C
86°F
```

Do not automatically convert units in Phase 5 unless there is a clear, tested requirement.

Unit conversion can become a later semantic-normalization feature.

---

# 29. Currency

Preserve currency symbols/codes:

```text
$100
₹100
€100
£100
USD 100
INR 100
```

Do not assume:

```text
$ = USD
```

in every context.

The original text should remain available.

---

# 30. Negation

Negation is one of the most important semantic features.

Preserve:

```text
not
never
no
without
doesn't
isn't
cannot
denies
```

Example:

```text
"NASA confirms Earth is not flat."
```

must never normalize into:

```text
"nasa confirms earth is flat"
```

This should have dedicated tests.

---

# 31. Question vs Claim

Users may select:

```text
"Is NASA hiding the truth?"
```

instead of:

```text
"NASA is hiding the truth."
```

These are not necessarily equivalent.

Do not remove question words simply to make hashing easier.

Phase 5 should preserve semantic structure as much as possible.

---

# 32. Named Entities

Important entities include:

```text
People
Organizations
Locations
Products
Countries
Scientific terms
Political institutions
```

Examples:

```text
NASA
WHO
India
OpenAI
Google
COVID-19
```

Do not aggressively spell-correct entity names.

A future entity extraction step can preserve them explicitly.

---

# 33. Entity Extraction

A lightweight NLP library may be used if needed.

Possible approaches include:

```text
compromise
spaCy service
custom regex/rules
```

Do not add a heavyweight NLP dependency merely because it is available.

Start with:

```text
Regex + deterministic rules
```

and add NLP only when evaluation shows a clear benefit.

---

# 34. Why Entity Extraction Matters

Consider:

```text
"Apple announces new AI device"
```

versus:

```text
"Apple announces new iPhone"
```

The claims are different.

Entities and key nouns should remain intact.

---

# 35. Tokenization

Tokenization can help analyze:

```text
words
numbers
punctuation
entities
```

A conceptual token sequence:

```text
["nasa", "confirms", "earth", "will", "experience", "3", "days", "of", "darkness"]
```

Do not use tokenization as an excuse to discard sentence structure.

---

# 36. Stop Words

Do **not** remove stop words for the primary hash.

Avoid transformations such as:

```text
"the"
"is"
"will"
"of"
"to"
```

being removed.

Why?

Because stop-word removal can alter meaning:

```text
"Earth will experience darkness"
```

versus:

```text
"Earth will not experience darkness"
```

The difference is critical.

---

# 37. Stemming and Lemmatization

Do not use stemming or aggressive lemmatization for the primary claim hash.

For example:

```text
"running"
"runs"
"ran"
```

may be linguistically related but are not always interchangeable in factual claims.

The cache should prioritize **precision of identity** over maximum semantic similarity.

---

# 38. Exact vs Semantic Hashing

This is a critical design decision.

SHA-256 is an **exact hash**.

Therefore:

```text
"earth is round"
```

and:

```text
"the earth is round"
```

will produce different hashes unless the normalization algorithm explicitly maps them to the same string.

Do not claim that SHA-256 itself understands semantic equivalence.

It does not.

---

# 39. HaCha's Cache Identity Strategy

The initial strategy should be:

```text
Deterministic formatting normalization
        ↓
SHA-256
```

not:

```text
Semantic embedding
        ↓
Nearest-neighbor cache
```

Semantic similarity can be explored later.

This keeps Phase 6 fast, deterministic, and explainable.

---

# 40. Optional Future Semantic Matching

A future version could have:

```text
Exact cache
    ↓ miss
Semantic cache
    ↓ miss
Verification
```

For example:

```text
"Earth is round"
```

could potentially match:

```text
"The Earth has a spherical shape"
```

But this introduces a dangerous risk:

> Similar claims are not necessarily identical claims.

Therefore, semantic caching must not be introduced casually.

---

# 41. Canonicalization Example

Input A:

```text
NASA CONFIRMS Earth will experience three days of darkness!!!
```

Input B:

```text
nasa confirms earth will experience three days of darkness
```

Input C:

```text
NASA confirms Earth will experience
three days of darkness.
```

Potential normalized output:

```text
nasa confirms earth will experience three days of darkness
```

All three can therefore share the same hash.

---

# 42. Different Claim Example

Input:

```text
NASA confirms Earth will experience three days of darkness.
```

Different input:

```text
NASA confirms Earth will experience five days of darkness.
```

Normalized:

```text
nasa confirms earth will experience three days of darkness
```

vs:

```text
nasa confirms earth will experience five days of darkness
```

These must produce different hashes.

---

# 43. Negation Example

Input A:

```text
Earth will experience darkness.
```

Input B:

```text
Earth will not experience darkness.
```

These must produce different hashes.

This should be a mandatory unit test.

---

# 44. Number Example

Input A:

```text
The vaccine is 95% effective.
```

Input B:

```text
The vaccine is 59% effective.
```

These must produce different hashes.

---

# 45. Entity Example

Input A:

```text
NASA confirms the discovery.
```

Input B:

```text
ESA confirms the discovery.
```

These must produce different hashes.

---

# 46. Hash Algorithm

Use:

```text
SHA-256
```

SHA-256 is appropriate because the goal is deterministic content identity rather than password storage.

The process is:

```text
normalizedClaim
       ↓
UTF-8 encoding
       ↓
SHA-256
       ↓
64-character hexadecimal digest
```

Example shape:

```text
a3f9...<64 hex characters>
```

Do not expose internal implementation assumptions to users.

---

# 47. Hash Function Contract

Create a small isolated utility:

```typescript
hashClaim(normalizedClaim: string): string
```

It should:

- Accept canonical text.
- Use UTF-8.
- Use SHA-256.
- Return deterministic hexadecimal output.
- Have no dependency on Express.
- Have no dependency on Redis.

---

# 48. Why Hashing Must Be Isolated

Later:

```text
Phase 6
Redis
```

will use the hash.

Potentially:

```text
Phase 13
Metrics
```

will use it.

Potentially:

```text
MongoDB
```

will store it.

Therefore, hashing should be a stable independent utility.

---

# 49. Cache Key Design

Phase 5 should prepare for Phase 6.

Potential future key:

```text
hacha:claim:v1:<sha256>
```

Example:

```text
hacha:claim:v1:a3f9...
```

Including:

```text
hacha
claim
v1
```

helps avoid collisions with unrelated Redis data and makes migrations easier.

---

# 50. Hash Privacy Consideration

A SHA-256 hash is not automatically anonymous.

If the claim is predictable, someone can potentially guess the claim and compute its hash.

Therefore:

```text
hash ≠ encryption
hash ≠ anonymization guarantee
```

The backend should avoid exposing unnecessary claim hashes publicly.

---

# 51. Original Text Storage

Keep the distinction:

```text
originalText
```

and:

```text
normalizedText
```

The original text is useful for:

- Debugging
- User display
- OCR comparison
- Audit
- Quality evaluation

The normalized text is useful for:

- Cache identity
- Search consistency
- Verification processing

---

# 52. Normalization Warnings

Some inputs may be risky to normalize.

For example:

```text
"20%"
```

or:

```text
"1/2"
```

or:

```text
"12/08/2026"
```

The system can optionally generate warnings:

```json
{
  "warnings": [
    "Ambiguous date format"
  ]
}
```

These warnings can be used later by the verification engine.

---

# 53. Suggested Claim Model

A useful Phase 5 model:

```typescript
interface ClaimIdentity {
  originalText: string;
  normalizedText: string;
  hash: string;
  normalizationVersion: "v1";
  warnings: string[];
}
```

Optional metadata:

```typescript
interface ClaimMetadata {
  numbers: string[];
  dates: string[];
  entities: string[];
  urls: string[];
  hashtags: string[];
  mentions: string[];
}
```

---

# 54. Normalization Pipeline API

A clean internal API could be:

```typescript
normalizeClaim(text)
```

returning:

```typescript
{
  originalText,
  normalizedText,
  warnings,
  metadata
}
```

Then:

```typescript
createClaimIdentity(normalizedClaim)
```

returns:

```typescript
{
  ...normalizedClaim,
  hash
}
```

This keeps normalization and hashing independently testable.

---

# 55. Determinism Requirement

The same input must always produce the same result.

Example:

```text
Input
 ↓
normalizeClaim()
 ↓
Output A
```

Running again:

```text
Same Input
 ↓
normalizeClaim()
 ↓
Output B
```

must satisfy:

```text
A.normalizedText === B.normalizedText
```

and:

```text
A.hash === B.hash
```

No timestamps, random values, or environment-dependent behavior should influence the hash.

---

# 56. Idempotency

Ideally:

```text
normalize(
    normalize(text)
)
```

should produce the same canonical representation.

Conceptually:

```text
normalize(text)
      =
normalize(normalize(text))
```

This property is useful for reliable pipelines.

---

# 57. Test Categories

Create tests for:

```text
Whitespace
Casing
Unicode
Punctuation
Emoji
Hashtags
Mentions
URLs
Numbers
Dates
Percentages
Units
Currency
Negation
Named entities
Multiline OCR
Empty text
Very long text
Mixed scripts
```

---

# 58. Whitespace Tests

Input:

```text
"NASA    confirms\nEarth\tis round"
```

Expected canonical form:

```text
"nasa confirms earth is round"
```

---

# 59. Case Tests

Input A:

```text
NASA CONFIRMS EARTH
```

Input B:

```text
nasa confirms earth
```

Expected:

```text
Same normalized form
Same hash
```

---

# 60. Punctuation Tests

Input:

```text
"NASA confirms Earth!!!"
```

Expected canonical form:

```text
"nasa confirms earth"
```

assuming the project's punctuation policy removes decorative punctuation.

---

# 61. Number Tests

Input A:

```text
"Population increased by 20%."
```

Input B:

```text
"Population increased by 30%."
```

Expected:

```text
Different normalized text
Different hash
```

---

# 62. Negation Tests

Input A:

```text
"Earth is flat."
```

Input B:

```text
"Earth is not flat."
```

Expected:

```text
Different normalized text
Different hash
```

---

# 63. Multilingual Tests

The normalization system should not corrupt:

```text
தமிழ்
മലയാളം
हिन्दी
العربية
```

For example, Unicode normalization and whitespace handling should preserve valid characters.

Multilingual OCR support may arrive later, but the backend should not be ASCII-only.

---

# 64. OCR Noise Tests

Test common OCR artifacts without implementing dangerous global replacements.

Example:

```text
"N A S A confirms Earth"
```

should be evaluated against:

```text
"NASA confirms Earth"
```

Only apply an automatic correction if the rule is demonstrably safe.

---

# 65. Claim-Length Behavior

Phase 4 already limits incoming claim size.

Phase 5 should still assume the input is untrusted.

Do not allow normalization to expand input dramatically.

For example:

```text
Huge repeated Unicode sequence
```

should not produce an enormous derived representation.

---

# 66. Security Considerations

Normalization must be safe against:

- Extremely long strings
- Unicode edge cases
- Repeated whitespace
- Malformed input
- Control characters
- Unexpected encodings
- Regex abuse

Avoid catastrophic regular expressions.

Prefer simple, linear-time transformations where possible.

---

# 67. Regex Safety

Be careful with complex regex patterns.

Avoid patterns that can cause catastrophic backtracking.

For example, do not build deeply nested ambiguous expressions for OCR cleanup.

Use:

```text
simple regex
+
bounded input
+
deterministic processing
```

---

# 68. Performance

Claim normalization should be fast.

The expected pipeline is:

```text
OCR text
 ↓
Normalization
 ↓
Hash
```

This should normally be much cheaper than:

```text
Fact-check API
Search
RAG
LLM
```

Measure normalization time during development.

---

# 69. Performance Metric

Add:

```text
normalizationTimeMs
hashTimeMs
```

to internal development metrics if useful.

Example:

```text
Normalization: 0.8 ms
SHA-256: 0.1 ms
```

These are illustrative only.

---

# 70. Phase 5 API Response

The Phase 4 `/api/verify` stub can now return:

```json
{
  "success": true,
  "data": {
    "originalClaim": "NASA CONFIRMS Earth will experience three days of darkness!!!",
    "normalizedClaim": "nasa confirms earth will experience three days of darkness",
    "claimHash": "a3f9...",
    "normalizationVersion": "v1",
    "verdict": "UNVERIFIED",
    "confidence": 0,
    "sources": [],
    "explanation": "Verification engine not enabled."
  }
}
```

This is still not a real fact-check result.

---

# 71. Do Not Expose Too Much

For production, consider whether the client actually needs:

```text
normalizedClaim
claimHash
normalizationVersion
```

Some of this can remain internal.

During development, exposing it is useful for debugging.

The production API can later return only what the UI needs.

---

# 72. Phase 5 → Phase 6 Contract

The key output is:

```text
claimHash
```

Phase 6 will use:

```text
claimHash
      ↓
Redis GET
```

If found:

```text
CACHE HIT
```

If not:

```text
CACHE MISS
      ↓
Fact checking
      ↓
Store result
```

This is the point where HaCha's viral-cache architecture becomes operational.

---

# 73. Why Exact Hashing Comes Before Redis

Do not build the Redis cache first.

If the identity function is unstable:

```text
Claim A
 ↓
Hash X

Same Claim A
 ↓
Hash Y
```

then Redis becomes unreliable.

Phase 5 therefore establishes the identity function first.

---

# 74. Example Viral Claim Flow

User 1:

```text
"NASA CONFIRMS Earth will experience three days of darkness!!!"
```

Normalization:

```text
nasa confirms earth will experience three days of darkness
```

Hash:

```text
H123
```

Verification:

```text
H123 → actual verification
```

Result:

```text
FALSE
```

User 2:

```text
"Nasa confirms earth will experience three days of darkness."
```

Normalization:

```text
nasa confirms earth will experience three days of darkness
```

Hash:

```text
H123
```

Future Phase 6:

```text
Redis H123
      ↓
FALSE
      ↓
No new verification required
```

---

# 75. Important Limitation

Normalization does not solve semantic equivalence.

These may still produce different hashes:

```text
"Earth is round."
```

and:

```text
"The Earth has a spherical shape."
```

That is acceptable for Phase 5.

The system prioritizes:

```text
high precision
+
deterministic identity
```

over:

```text
aggressive semantic matching
```

Semantic matching can be considered as a separate future layer.

---

# 76. Phase 5 Demonstration

A strong project demo is:

```text
Input A:
NASA CONFIRMS Earth will experience
three days of darkness!!!

Input B:
nasa confirms earth will experience
three days of darkness.
```

Show:

```text
Normalized A:
nasa confirms earth will experience three days of darkness

Normalized B:
nasa confirms earth will experience three days of darkness
```

Then:

```text
SHA-256 A:
H123...

SHA-256 B:
H123...
```

Then demonstrate:

```text
20% vs 30%
```

produces different hashes.

This clearly shows why the cache will work.

---

# 77. Phase 5 Exit Criteria

Phase 5 is complete when:

- [ ] Raw claims enter the normalization pipeline.
- [ ] Original text is preserved separately.
- [ ] Unicode normalization is implemented safely.
- [ ] Leading/trailing whitespace is removed.
- [ ] Repeated whitespace is normalized.
- [ ] Case normalization is deterministic.
- [ ] Decorative punctuation handling is deterministic.
- [ ] OCR artifacts are handled conservatively.
- [ ] Hashtags can be identified.
- [ ] Mentions can be identified.
- [ ] URLs can be identified.
- [ ] Numbers are preserved.
- [ ] Dates are preserved.
- [ ] Percentages are preserved.
- [ ] Units are preserved.
- [ ] Currency values are preserved.
- [ ] Named entities are preserved.
- [ ] Negation is preserved.
- [ ] Stop words are not blindly removed.
- [ ] Stemming/lemmatization is not used for the primary hash.
- [ ] SHA-256 hashing is implemented.
- [ ] Hashing uses deterministic UTF-8 input.
- [ ] Normalization version is recorded.
- [ ] Normalization is deterministic.
- [ ] Normalization is idempotent where designed.
- [ ] Equivalent formatting variations produce the same canonical form where intended.
- [ ] Meaningfully different claims produce different hashes.
- [ ] Multilingual text is not corrupted.
- [ ] Edge-case tests pass.
- [ ] Performance is acceptable.
- [ ] Phase 6 can consume the claim hash.

---

# 78. Definition of Done

The Phase 5 definition of done is:

```text
Raw OCR/User-confirmed Claim
            ↓
      Validation
            ↓
       Normalize
            ↓
   Canonical Claim
            ↓
        SHA-256
            ↓
      Claim Identity
            ↓
     Ready for Redis
```

The system must reliably answer:

> **"Have I seen this same normalized claim before?"**

That question becomes the foundation of Phase 6.

---

# 79. Suggested Git Commits

```text
feat(backend): add claim normalization module

feat(backend): add unicode normalization

feat(backend): add whitespace normalization

feat(backend): add punctuation normalization

feat(backend): add claim metadata extraction

feat(backend): preserve numbers and dates

feat(backend): add claim hashing

feat(backend): add normalization versioning

feat(backend): integrate claim identity into verify service

test(backend): add normalization edge cases

test(backend): add hash determinism tests

test(backend): add multilingual normalization tests

test(backend): add semantic-safety regression tests

docs(backend): document claim normalization strategy
```

---

# 80. Phase 5 Deliverables

At the end of Phase 5:

```text
backend/
│
├── src/
│   ├── services/
│   │   ├── verification.service.ts
│   │   │
│   │   └── claim/
│   │       ├── claim-normalizer.ts
│   │       ├── claim-hasher.ts
│   │       ├── claim-tokenizer.ts
│   │       ├── entity-extractor.ts
│   │       ├── number-preserver.ts
│   │       └── normalization-rules.ts
│   │
│   ├── types/
│   │   └── claim.ts
│   │
│   └── ...
│
├── tests/
│   └── claim/
│       ├── normalization.test.ts
│       └── hashing.test.ts
│
└── README.md
```

Not every module must be implemented as a separate file if the codebase remains small.

---

# 81. Recommended Development Order

Implement Phase 5 in this order:

```text
Step 1
Create ClaimIdentity type
        ↓
Step 2
Create normalization pipeline
        ↓
Step 3
Add Unicode normalization
        ↓
Step 4
Add whitespace normalization
        ↓
Step 5
Add safe punctuation handling
        ↓
Step 6
Add case normalization
        ↓
Step 7
Add OCR artifact handling
        ↓
Step 8
Add metadata extraction
        ↓
Step 9
Verify numbers/dates/units are preserved
        ↓
Step 10
Add SHA-256 utility
        ↓
Step 11
Add normalization version
        ↓
Step 12
Integrate with verification service
        ↓
Step 13
Add comprehensive tests
        ↓
Step 14
Test deterministic hashing
        ↓
Step 15
Test multilingual input
        ↓
Step 16
Measure performance
        ↓
Step 17
Phase 5 exit validation
```

---

# 82. Important Technical Decision

Do not use an LLM to normalize the claim in Phase 5.

Avoid:

```text
Claim
 ↓
LLM
 ↓
"cleaned claim"
```

The normalization layer should be:

```text
deterministic
fast
cheap
repeatable
explainable
```

An LLM could produce different outputs for the same input and would make cache identity unpredictable.

LLMs belong in the reasoning stage, not the identity-generation stage.

---

# 83. Important Product Decision

The cache should optimize **identical/equivalent formatting variations**, not pretend to understand all semantic equivalence.

Good:

```text
NASA CONFIRMS EARTH!!!
```

and:

```text
nasa confirms earth
```

→ same normalized identity.

Do not automatically assume:

```text
Earth is round.
```

and:

```text
Earth is spherical.
```

are identical cache entries.

The latter requires semantic reasoning and introduces false-cache risks.

---

# 84. Phase 5 Final Summary

Phase 5 creates HaCha's **claim identity layer**.

The project now has:

```text
Phase 1
Extension activation
        ↓
Phase 2
Visual region selection
        ↓
Phase 3
Local OCR
        ↓
Phase 4
Backend gateway
        ↓
Phase 5
Canonical claim + SHA-256 identity
```

The resulting pipeline is:

```text
                USER
                  │
                  ▼
            Selects content
                  │
                  ▼
             Local OCR
                  │
                  ▼
          Human confirmation
                  │
                  ▼
          Node.js Gateway
                  │
                  ▼
         Claim Normalization
                  │
                  ▼
         Canonical Claim
                  │
                  ▼
              SHA-256
                  │
                  ▼
          Claim Identity
                  │
                  ▼
           Phase 6 Redis
```

The key principle is:

> **A cache is only as reliable as the identity used to index it.**

Phase 5 therefore establishes that identity before Redis is introduced.

At the end of this phase, HaCha has evolved from:

```text
Phase 1
"HaCha can activate."
        ↓
Phase 2
"HaCha can select content."
        ↓
Phase 3
"HaCha can read content locally."
        ↓
Phase 4
"HaCha can send confirmed text to its gateway."
        ↓
Phase 5
"HaCha can deterministically identify a claim."
```

The next phase is **Phase 6 — Redis Caching Layer**, where this claim identity becomes the key to HaCha's viral-cache system: cache hits should bypass expensive verification entirely.
