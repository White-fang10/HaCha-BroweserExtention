# HaCha AI Fact Checker
## Phase 7 — Fact-Check Database Integration

> **Phase objective:** Add the first real verification layer to HaCha by integrating the Google Fact Check Tools Claim Search API. The system will query existing fact-check reviews for a normalized claim, map external ratings into HaCha's controlled verdict taxonomy, preserve source attribution, and cache the resulting evidence-backed response in Redis.

---

# 1. Phase Overview

Phases 1–6 established the infrastructure:

```text
User
 ↓
Region Selection
 ↓
Local OCR
 ↓
Human Confirmation
 ↓
Node.js Gateway
 ↓
Claim Normalization
 ↓
SHA-256
 ↓
Redis Cache
```

Phase 7 introduces the first real source of factual evidence:

```text
Confirmed Claim
      ↓
Normalize
      ↓
SHA-256
      ↓
Redis
      │
      ├── HIT ───────────────→ Cached Result
      │
      └── MISS
             ↓
      Google Fact Check API
             ↓
      Existing fact-check?
          │
       ┌──┴──┐
      YES    NO
       │      │
       ▼      ▼
  Map Rating  Continue to
       │      Phase 9/10
       ▼
  Cache Result
       │
       ▼
   Return to UI
```

The important design principle is:

> **HaCha should use an existing authoritative fact-check when one is available instead of asking an LLM to independently judge the claim.**

---

# 2. Current API Reality

The Google Fact Check Tools documentation currently provides a **Fact Check Claim Search API** for searching fact-checked claims. The documented REST method is:

```http
GET https://factchecktools.googleapis.com/v1alpha1/claims:search
```

The search supports parameters including:

```text
query
languageCode
reviewPublisherSiteFilter
maxAgeDays
pageSize
pageToken
offset
```

The API requires an API key for the Claim Search API. Google's documentation states that it provides access to the same set of fact-check results available through Fact Check Explorer.

Official documentation:

- Google Fact Check Tools API
- Google Fact Check Claim Search API
- Google Claim / ClaimReview resource documentation

These official references should be checked again immediately before production deployment because API behavior, quotas, terms, and documentation can change.

---

# 3. Phase 7 Goals

By the end of Phase 7:

- Google Fact Check Tools API is configured.
- API credentials are stored securely.
- Backend can search fact-checked claims.
- Query construction is separated from the HTTP client.
- External responses are validated.
- Multiple ClaimReview results can be handled.
- External ratings are mapped into HaCha's taxonomy.
- Original publisher attribution is preserved.
- Source URLs are preserved.
- Review dates are preserved.
- Claimant information is preserved where available.
- Matching quality is evaluated instead of blindly accepting the first result.
- A real fact-check result can be cached in Redis.
- API failures are handled gracefully.
- No-result responses fall through to the future AI pipeline.
- Rate/usage considerations are documented.
- Unit and integration tests pass.

---

# 4. What Phase 7 Does NOT Implement

Do not implement yet:

```text
❌ Web search
❌ News retrieval
❌ RAG
❌ LLM reasoning
❌ Python AI service
❌ Evidence ranking across arbitrary websites
❌ Semantic search over your own vector database
❌ Final AI-generated verdict for novel claims
```

Those belong primarily to Phases 9 and 10.

Phase 7 is specifically:

```text
Existing fact-check database
        ↓
Search
        ↓
Interpret
        ↓
Attribute
        ↓
Cache
```

---

# 5. Why This Tier Comes Before AI

An LLM should not be the first thing HaCha asks when a claim is already covered by a professional fact-check.

Example:

```text
User checks claim
       ↓
Google Fact Check search
       ↓
Existing review found
       ↓
Use the published review
```

This is preferable to:

```text
User checks claim
       ↓
LLM guesses
       ↓
Potential hallucination
```

The external fact-check result provides:

- Existing human/editorial review
- Publisher attribution
- Review URL
- Review date
- Original claim
- Published rating

This makes the result more transparent.

---

# 6. Updated Architecture

After Phase 7:

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
                    Cache HIT?
                    /         \
                  YES          NO
                   │            │
                   ▼            ▼
              Cached Result   Google
                              Fact Check
                                 │
                         ┌───────┴───────┐
                         │               │
                       Match           No Match
                         │               │
                         ▼               ▼
                    Map Rating       Future AI
                         │           Pipeline
                         ▼
                       Redis
                         │
                         ▼
                    Chrome UI
```

---

# 7. Recommended Backend Structure

Extend the existing structure:

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
│   ├── services/
│   │   ├── verification.service.ts
│   │   │
│   │   ├── claim/
│   │   │   ├── claim-normalizer.ts
│   │   │   └── claim-hasher.ts
│   │   │
│   │   ├── cache/
│   │   │   ├── redis.client.ts
│   │   │   ├── redis-cache.service.ts
│   │   │   └── cache-key.ts
│   │   │
│   │   └── factcheck/
│   │       ├── google-factcheck.client.ts
│   │       ├── factcheck.service.ts
│   │       ├── factcheck.mapper.ts
│   │       ├── factcheck.matcher.ts
│   │       └── factcheck.types.ts
│   │
│   ├── schemas/
│   │   ├── verify.schema.ts
│   │   └── factcheck.schema.ts
│   │
│   ├── types/
│   │   ├── api.ts
│   │   ├── claim.ts
│   │   └── verification.ts
│   │
│   └── utils/
│       └── logger.ts
│
├── tests/
│   ├── factcheck/
│   │   ├── client.test.ts
│   │   ├── mapper.test.ts
│   │   └── matcher.test.ts
│   │
│   └── ...
│
├── .env.example
└── README.md
```

Keep the Google-specific implementation isolated.

---

# 8. Environment Variables

Extend `.env.example`:

```env
GOOGLE_FACTCHECK_API_KEY=your_api_key_here

FACTCHECK_ENABLED=true
FACTCHECK_LANGUAGE=en
FACTCHECK_PAGE_SIZE=10
FACTCHECK_MAX_AGE_DAYS=
FACTCHECK_TIMEOUT_MS=5000
```

Never commit:

```text
GOOGLE_FACTCHECK_API_KEY
```

to Git.

---

# 9. API Key Security

The API key belongs in the backend.

Correct:

```text
Chrome Extension
       ↓
Node.js Backend
       ↓
Google Fact Check API
```

Incorrect:

```text
Chrome Extension
       ↓
Google API key embedded in extension
```

Anything shipped inside a Chrome extension should be considered recoverable by users.

Therefore, keep the API key server-side.

---

# 10. Google API Request

The backend should call the Claim Search endpoint.

Conceptually:

```http
GET /v1alpha1/claims:search
```

with parameters such as:

```text
query=<normalized claim>
languageCode=en
pageSize=10
```

The exact request configuration should remain centralized in the Google client.

---

# 11. Query Construction

Do not simply concatenate arbitrary user data into a URL manually.

Use a proper URL/query-parameter mechanism.

Conceptually:

```typescript
const params = new URLSearchParams({
  query: normalizedClaim,
  languageCode: "en",
  pageSize: "10"
});
```

Then make the request through a controlled HTTP client.

---

# 12. Query Length

Normalized claims can still be long.

Do not blindly send an enormous paragraph as a search query.

Introduce a bounded query strategy.

Possible approach:

```text
Normalized claim
      ↓
Length check
      ↓
If reasonable → search directly
      ↓
If too long → construct a concise search representation
```

Do not truncate in a way that removes critical numbers or negation.

---

# 13. Query Preservation

Important information should survive query construction:

```text
People
Organizations
Places
Numbers
Dates
Percentages
Key nouns
Negation
```

Example:

```text
"The vaccine is 95% effective and was approved in 2024."
```

should not become:

```text
"vaccine effective"
```

because the year and percentage can be essential to finding the correct fact-check.

---

# 14. Language

The API supports a `languageCode` parameter.

For the initial implementation:

```env
FACTCHECK_LANGUAGE=en
```

or an appropriate BCP-47 value can be configured.

Do not assume all claims are English forever.

Phase 3/5 already established multilingual-safe text handling.

Multilingual fact-checking can be expanded later.

---

# 15. Page Size

Start with a small bounded page size:

```text
10
```

The backend does not need hundreds of results for every claim.

The objective is:

```text
small candidate set
       ↓
matching
       ↓
best supported result
```

---

# 16. Google Response Structure

The API returns fact-checked claims and associated review information.

Conceptually:

```json
{
  "claims": [
    {
      "text": "...",
      "claimant": "...",
      "claimDate": "...",
      "claimReview": [
        {
          "publisher": {
            "name": "...",
            "site": "..."
          },
          "url": "...",
          "title": "...",
          "reviewDate": "...",
          "textualRating": "..."
        }
      ]
    }
  ]
}
```

The exact API resource schema should be validated against Google's current documentation and your runtime response.

---

# 17. Never Trust External JSON Blindly

Even documented APIs can return:

```text
missing fields
null values
unexpected arrays
unknown rating strings
```

Therefore:

```text
Google response
      ↓
Schema validation
      ↓
Internal representation
```

Do not pass raw external JSON directly to the extension.

---

# 18. Internal Representation

Create a normalized internal model:

```typescript
interface ExternalFactCheck {
  claimText: string;
  claimant?: string;
  claimDate?: string;

  publisher: {
    name: string;
    site?: string;
  };

  review: {
    title?: string;
    url: string;
    reviewDate?: string;
    textualRating: string;
  };
}
```

This protects the rest of the application from Google-specific schema details.

---

# 19. Why an Adapter Layer Matters

Without an adapter:

```text
Verification Service
      ↓
Google JSON everywhere
```

Later, if you add another source:

```text
Google
MediaBiasFactCheck
Local fact-check database
Other provider
```

the whole application becomes coupled to different schemas.

Instead:

```text
Google
  ↓
Google Adapter
  ↓
Internal FactCheck model
  ↓
Verification Service
```

This is much more maintainable.

---

# 20. Fact-Check Matching

A search result does not automatically mean:

> "This is the same claim."

This is one of the most important parts of Phase 7.

Suppose the user checks:

```text
"NASA confirms Earth will experience three days of darkness."
```

and Google returns:

```text
"NASA predicts three days of darkness on Earth."
```

That might be related.

But:

```text
"NASA confirms three years of darkness."
```

is materially different.

Therefore, matching must be explicit.

---

# 21. Candidate Matching Pipeline

Use:

```text
Google results
      ↓
Candidate filtering
      ↓
Text similarity
      ↓
Entity comparison
      ↓
Number comparison
      ↓
Date comparison
      ↓
Negation check
      ↓
Rating extraction
      ↓
Confidence/match decision
```

---

# 22. Start With Deterministic Matching

Do not use an LLM for matching in Phase 7.

Start with:

```text
Normalized text similarity
+
token overlap
+
numbers
+
entities
+
negation
```

This is:

- Fast
- Cheap
- Deterministic
- Easier to test

---

# 23. Exact Match

Best case:

```text
User normalized claim
=
Fact-check claim normalized text
```

Then:

```text
HIGH MATCH
```

This is the safest scenario.

---

# 24. Near Match

Example:

```text
User:
"NASA confirms Earth will experience three days of darkness."

Fact-check:
"NASA says Earth will not experience three days of darkness."
```

A simple token similarity score could look high.

But the negation changes everything.

Therefore:

> **Similarity alone must never decide a factual match.**

---

# 25. Negation Check

Before accepting a candidate, explicitly compare negation terms.

For example:

```text
not
never
no
without
does not
isn't
cannot
```

If the candidate and user claim have conflicting negation structure:

```text
Reject candidate
```

or mark:

```text
LOW MATCH
```

Do not automatically reuse the external verdict.

---

# 26. Number Consistency

Numbers must be compared.

Example:

```text
User:
"5 people died."

Candidate:
"50 people died."
```

A high textual similarity score should not cause these to match.

Numbers should be treated as high-value tokens.

---

# 27. Date Consistency

Dates should also be compared.

Example:

```text
2025
```

vs:

```text
2026
```

could represent different events.

Do not merge them simply because the sentence structure is similar.

---

# 28. Entity Consistency

Compare important entities:

```text
NASA
```

vs:

```text
ESA
```

or:

```text
India
```

vs:

```text
Indonesia
```

These should not be treated as interchangeable.

---

# 29. Matching Score

A conceptual score can combine:

```text
Text similarity
Entity agreement
Number agreement
Date agreement
Negation agreement
```

Example conceptual model:

```text
matchScore =
  0.50 × textSimilarity
+ 0.20 × entityAgreement
+ 0.15 × numberAgreement
+ 0.10 × dateAgreement
+ 0.05 × negationAgreement
```

These weights are only an initial design example.

Do not present them as scientifically validated.

Phase 13 should evaluate and tune the matcher.

---

# 30. Better Rule: Critical Mismatch Overrides Score

Even if:

```text
matchScore = 0.94
```

reject the candidate if:

```text
number mismatch
```

or:

```text
entity mismatch
```

or:

```text
negation conflict
```

This is safer than trusting a weighted score alone.

---

# 31. Match Categories

Use internal categories:

```text
EXACT
HIGH_CONFIDENCE
LOW_CONFIDENCE
NO_MATCH
```

Only:

```text
EXACT
HIGH_CONFIDENCE
```

should normally be eligible for automatic reuse.

Low-confidence results should fall through to the next verification tier.

---

# 32. External Rating Mapping

Fact-check publishers use different rating vocabularies.

Examples can include:

```text
True
Mostly True
False
Mostly False
Misleading
Half True
Unsubstantiated
Unsupported
```

HaCha needs a controlled taxonomy.

---

# 33. HaCha Verdict Taxonomy

Use:

```text
SUPPORTED
FALSE
MISLEADING
UNVERIFIED
```

Meaning:

### SUPPORTED

Available fact-check evidence supports the claim.

### FALSE

The fact-check explicitly indicates the claim is false.

### MISLEADING

The claim contains a misleading framing, missing context, exaggeration, or partial truth.

### UNVERIFIED

There is not enough trustworthy evidence to assign a reliable verdict.

---

# 34. Why "TRUE" Should Be Avoided

Calling something simply:

```text
TRUE
```

can imply that HaCha independently proved the claim.

Instead:

```text
SUPPORTED
```

communicates:

> An identified fact-check source supports the claim.

This better reflects the evidence provenance.

---

# 35. Rating Mapper

Create:

```text
factcheck.mapper.ts
```

with a function such as:

```typescript
mapExternalRating(
  rating: string
): HachaVerdict
```

Example conceptual mapping:

```text
"True"
"Correct"
"Accurate"
        ↓
SUPPORTED

"False"
"Incorrect"
"Wrong"
        ↓
FALSE

"Misleading"
"Half True"
"Missing Context"
        ↓
MISLEADING

"Unverified"
"Unsupported"
"No Evidence"
        ↓
UNVERIFIED
```

The actual mapping must be conservative and source-aware.

---

# 36. Unknown Ratings

Never silently map an unknown rating to:

```text
FALSE
```

For example:

```text
"Needs More Context"
```

may not clearly mean false.

Unknown rating:

```text
UNVERIFIED
```

or:

```text
MANUAL_REVIEW
```

internally.

---

# 37. Publisher Attribution

HaCha must preserve the original publisher.

Example:

```json
{
  "publisher": {
    "name": "Example Fact Check Organization",
    "site": "example.org"
  }
}
```

The UI should communicate:

```text
Source:
Example Fact Check Organization
```

not simply:

```text
HaCha says this is false.
```

---

# 38. Source URL

Always preserve the review URL:

```json
{
  "url": "https://..."
}
```

The user should be able to open the original fact-check.

The backend should validate that the URL is structurally valid before returning it.

---

# 39. Source Title

Preserve:

```text
review title
```

This makes the source card useful.

Example:

```text
Example Fact Check: NASA Darkness Claim Debunked
```

---

# 40. Review Date

Preserve:

```text
reviewDate
```

This is important for freshness.

A five-year-old fact-check may still be useful, but the user should know when it was published.

---

# 41. Claimant

If the API provides:

```text
claimant
```

preserve it.

This helps distinguish:

```text
Who made the claim?
```

from:

```text
Who reviewed the claim?
```

---

# 42. Original Claim Text

Store the fact-check publisher's original claim:

```text
externalClaimText
```

This is useful for:

- Matching
- UI transparency
- Debugging
- Evaluation

The UI can optionally show:

```text
Fact-check source reviewed:
"..."
```

---

# 43. Evidence Attribution Principle

HaCha should never make the external fact-check appear to be generated by HaCha.

Bad:

```text
HaCha determined this is FALSE.
```

Better:

```text
FALSE according to [publisher].
```

or:

```text
Fact-check source rates this claim as FALSE.
```

This distinction is critical for credibility.

---

# 44. Result Model

Create a normalized internal result:

```typescript
interface VerificationResult {
  verdict:
    | "SUPPORTED"
    | "FALSE"
    | "MISLEADING"
    | "UNVERIFIED";

  confidence: number;

  explanation: string;

  sources: VerificationSource[];

  provider: "google-factcheck";

  providerMatch: {
    type: "EXACT" | "HIGH_CONFIDENCE";
    score?: number;
  };

  checkedAt: string;
}
```

---

# 45. Confidence Meaning

Do not confuse:

```text
match confidence
```

with:

```text
factual confidence
```

These are different.

For example:

```text
matchScore = 0.97
```

means:

> The external fact-check appears to refer to the same claim.

It does not automatically mean:

> The claim is 97% certainly false.

Keep these concepts separate internally.

---

# 46. Recommended Internal Fields

A richer structure:

```typescript
interface FactCheckResult {
  verdict: HachaVerdict;

  claim: {
    original: string;
    normalized: string;
    hash: string;
  };

  match: {
    type: MatchType;
    score?: number;
  };

  source: {
    publisherName: string;
    publisherSite?: string;
    title?: string;
    url: string;
    reviewDate?: string;
  };

  externalRating: string;

  explanation: string;

  checkedAt: string;

  provider: "google-factcheck";
}
```

---

# 47. Explanation Generation

Phase 7 should **not invent explanations**.

If the external source provides a useful review title/rating, HaCha can summarize minimally.

For the initial version:

```text
The claim was previously fact-checked by <publisher>, which rated it <external rating>.
```

Then provide:

```text
Read the original fact-check
```

Do not fabricate details that are not present in the API response.

---

# 48. No-Match Behavior

If Google returns:

```text
claims = []
```

the result is NOT:

```text
FALSE
```

It means:

```text
No matching fact-check found.
```

Therefore:

```text
Google no match
      ↓
Do not verdict false
      ↓
Continue to Phase 9/10
```

This is one of the most important safeguards.

---

# 49. API Error Behavior

Possible failures:

```text
Invalid API key
Quota exceeded
Timeout
Network error
Google service unavailable
Malformed response
```

The backend should distinguish:

```text
NO_MATCH
```

from:

```text
API_ERROR
```

They have completely different meanings.

---

# 50. API Error Fallback

Recommended flow:

```text
Redis MISS
   ↓
Google Fact Check
   │
   ├── Match → return/cache
   │
   ├── No Match → Phase 9
   │
   └── API Error → Phase 9 or controlled fallback
```

Do not tell the user:

```text
Claim is unverified
```

just because Google's API was temporarily unavailable.

---

# 51. Timeout

Configure:

```env
FACTCHECK_TIMEOUT_MS=5000
```

The exact value can be tuned.

If the request times out:

```text
Google timeout
 ↓
Log
 ↓
Continue fallback pipeline
```

Do not leave the user's request hanging indefinitely.

---

# 52. API Key Failure

If the API key is invalid:

```text
Google returns authentication error
```

This is a configuration problem.

The system should:

- Log a safe diagnostic.
- Avoid exposing the API key.
- Mark the provider unavailable.
- Continue to the fallback path where appropriate.

---

# 53. Rate Limits / Quotas

The Fact Check Claim Search API requires an API key, and its use is subject to Google's API terms.

Do not design the architecture assuming unlimited free calls.

This is another reason Phase 6 Redis caching comes before Phase 7.

The cache reduces repeated external calls.

---

# 54. API Call Optimization

The correct order is:

```text
Request
 ↓
Normalize
 ↓
Hash
 ↓
Redis
 ↓
Only on MISS:
Google Fact Check
```

Never:

```text
Request
 ↓
Google API
 ↓
Redis
```

Otherwise the cache cannot protect the API quota.

---

# 55. Cache External Results

When Google returns a valid matching fact-check:

```text
Google result
      ↓
Normalize internal result
      ↓
Redis SET
      ↓
Return
```

The next identical claim can skip Google entirely.

---

# 56. Cache No-Match Results?

This requires more care.

If you cache:

```text
NO_MATCH
```

for too long, a newly published fact-check may not be discovered.

For the MVP, either:

```text
Do not cache no-match results
```

or use a much shorter TTL.

A short negative-cache TTL can reduce repeated queries without making the system stale for long.

---

# 57. Recommended Negative Cache

Example:

```env
FACTCHECK_NO_MATCH_TTL_SECONDS=900
```

15 minutes is an example starting point.

The value should be evaluated experimentally.

---

# 58. Why Negative Caching Helps

Suppose a claim is repeatedly checked but no fact-check exists.

Without negative caching:

```text
1,000 users
 ↓
1,000 Google searches
```

With negative caching:

```text
First request
 ↓
Google → NO MATCH
 ↓
Short negative cache

Next requests
 ↓
Negative cache HIT
```

This protects API usage.

---

# 59. Cache Status Types

Internally distinguish:

```text
POSITIVE
NEGATIVE
```

Example:

```json
{
  "cacheType": "NEGATIVE",
  "status": "NO_MATCH"
}
```

Do not confuse:

```text
NO_MATCH
```

with:

```text
FALSE
```

They are fundamentally different.

---

# 60. Verification Provider Interface

Design for future providers.

Example:

```typescript
interface FactCheckProvider {
  searchClaim(
    claim: NormalizedClaim
  ): Promise<FactCheckProviderResult>;
}
```

Google becomes:

```text
GoogleFactCheckProvider
```

Future providers can implement the same interface.

---

# 61. Provider Result

A provider can return:

```typescript
interface FactCheckProviderResult {
  status: "MATCH" | "NO_MATCH" | "ERROR";

  results: ExternalFactCheck[];

  provider: string;

  errorCode?: string;
}
```

This keeps provider-specific details out of the verification service.

---

# 62. Provider Adapter Architecture

```text
Verification Service
        │
        ▼
FactCheckProvider
        │
        ├── Google
        │
        ├── Future Provider A
        │
        └── Future Provider B
```

This is much more scalable than hardcoding Google logic into `/api/verify`.

---

# 63. Testing Google Integration

Do not depend entirely on live Google calls during automated tests.

Use mocked API responses.

Test:

```text
Exact match
Near match
No match
Multiple matches
Unknown rating
Missing URL
Missing publisher
Timeout
API error
Malformed JSON
```

---

# 64. Exact Match Test

Input:

```text
NASA confirms Earth will experience three days of darkness.
```

Mock Google:

```text
Same claim text
Rating: False
```

Expected:

```text
verdict = FALSE
match = EXACT
provider = google-factcheck
```

---

# 65. No Match Test

Mock:

```json
{
  "claims": []
}
```

Expected:

```text
status = NO_MATCH
```

Then:

```text
Do not return FALSE.
```

---

# 66. Unknown Rating Test

Mock:

```text
rating = "Needs Context"
```

Expected:

```text
verdict = UNVERIFIED
```

unless a source-specific mapping explicitly defines it.

---

# 67. Negation Mismatch Test

User:

```text
"Earth will not experience darkness."
```

Fact-check candidate:

```text
"Earth will experience darkness."
```

Expected:

```text
Candidate rejected
```

even if textual similarity is high.

---

# 68. Number Mismatch Test

User:

```text
"5 people died."
```

Candidate:

```text
"50 people died."
```

Expected:

```text
Candidate rejected
```

---

# 69. Entity Mismatch Test

User:

```text
"NASA announced..."
```

Candidate:

```text
"ESA announced..."
```

Expected:

```text
Candidate rejected or low-confidence
```

depending on the matching policy.

---

# 70. Publisher Attribution Test

Mock response:

```text
Publisher:
Example Fact Check

URL:
https://example.org/fact-check

Rating:
False
```

Expected internal result must preserve:

```text
publisherName
publisherSite
URL
externalRating
```

---

# 71. Redis Integration Test

Test:

```text
Request 1
 ↓
Redis MISS
 ↓
Google called
 ↓
Result cached

Request 2
 ↓
Redis HIT
 ↓
Google NOT called
```

This proves Phase 6 and Phase 7 work together.

---

# 72. API Failure + Redis Test

Scenario:

```text
Redis MISS
 ↓
Google API error
```

Expected:

```text
No false verdict
No fake cache entry
Fallback/controlled error
```

Do not cache an API failure as if it were a factual verdict.

---

# 73. Cache Poisoning Test

Ensure the client cannot submit:

```json
{
  "verdict": "SUPPORTED"
}
```

and cause Redis to store it.

Only server-side provider/verification logic may write the result.

---

# 74. Phase 7 Metrics

Track:

```text
factCheckApiRequests
factCheckMatches
factCheckNoMatches
factCheckErrors
factCheckTimeouts
factCheckMatchRate
factCheckLatency
cachedFactCheckHits
```

Potential metric:

```text
matchRate =
matches / successful searches
```

This helps determine whether the first-tier API is actually useful for the project's target claims.

---

# 75. Match Accuracy Evaluation

Create a labeled dataset:

```text
Claim
Expected matching fact-check
Expected verdict
Expected publisher
```

Measure:

```text
Exact-match precision
False-match rate
No-match accuracy
Rating mapping accuracy
```

The most important metric is:

> **How often does HaCha incorrectly attach an existing fact-check to a different claim?**

A false match can be worse than a missed match.

---

# 76. Conservative Matching Principle

Prefer:

```text
Missed fact-check
```

over:

```text
Wrong fact-check attached
```

For credibility:

```text
Precision > Recall
```

at this stage.

The AI/RAG tier can handle claims that the first tier cannot confidently match.

---

# 77. Source Quality

Google's result set contains fact-check reviews from publishers.

Do not assume every publisher is equally authoritative for every domain.

Phase 7 should preserve publisher identity.

Later Phase 9 can introduce:

```text
source authority
source reputation
cross-source agreement
```

Do not silently replace publisher ratings with your own credibility score yet.

---

# 78. Multiple Fact-Checks

Google may return multiple reviews for related claims.

Do not simply choose:

```text
claims[0]
```

Instead:

```text
Candidate results
       ↓
Filter
       ↓
Match
       ↓
Rank
       ↓
Select
```

Potential ranking factors:

```text
Claim similarity
Entity agreement
Number agreement
Date relevance
Review recency
```

---

# 79. Conflicting Fact-Checks

Different publishers may rate similar claims differently.

Example:

```text
Publisher A → False
Publisher B → Misleading
```

Do not arbitrarily select one and hide the disagreement.

A future result model should support:

```text
conflicting sources
```

For Phase 7, if the conflict cannot be resolved confidently:

```text
UNVERIFIED
```

or:

```text
CONTESTED
```

internally.

---

# 80. Do Not Invent a Consensus

If two publishers disagree:

```text
A says FALSE
B says MISLEADING
```

do not generate:

```text
Consensus = FALSE
```

unless your evidence layer explicitly supports that conclusion.

---

# 81. UI Result Concept

Phase 7 can provide the extension with:

```text
FALSE
According to:
Example Fact Check Organization

"Publisher's rating: False"

[Read source]
```

The UI should clearly separate:

```text
HaCha interface
```

from:

```text
Original fact-check publisher
```

---

# 82. Example API Response

```json
{
  "success": true,
  "data": {
    "claim": "NASA confirms Earth will experience three days of darkness.",
    "verdict": "FALSE",
    "confidence": 0.97,
    "explanation": "This claim was previously fact-checked and rated false by the cited publisher.",
    "sources": [
      {
        "publisher": "Example Fact Check",
        "title": "Fact Check: Three Days of Darkness Claim",
        "url": "https://example.org/fact-check",
        "reviewDate": "2026-01-10",
        "rating": "False"
      }
    ]
  },
  "meta": {
    "cacheHit": false,
    "provider": "google-factcheck",
    "matchType": "EXACT"
  }
}
```

The URL above is illustrative; use actual API-provided URLs in the implementation.

---

# 83. No-Match API Response

For Phase 7, a no-match result should not pretend to know the truth.

Internally:

```text
provider = google-factcheck
status = NO_MATCH
```

Then the gateway can continue:

```text
Phase 9 evidence retrieval
```

Once implemented.

---

# 84. Phase 7 Current End-to-End Flow

```text
User selects claim
        ↓
Local OCR
        ↓
User confirms
        ↓
Node Gateway
        ↓
Normalize
        ↓
SHA-256
        ↓
Redis
   ┌────┴────┐
  HIT       MISS
   │          │
   ▼          ▼
Return    Google Fact Check
             │
        ┌────┴─────┐
       MATCH     NO MATCH
         │          │
         ▼          ▼
      Map rating   Phase 9
         │
         ▼
      Redis SET
         │
         ▼
       Return
```

---

# 85. Phase 7 Exit Criteria

Phase 7 is complete when:

- [ ] Google Fact Check Claim Search API is configured.
- [ ] API key is stored server-side.
- [ ] API key is excluded from Git.
- [ ] Google API client is isolated from business logic.
- [ ] Query construction is implemented.
- [ ] Query size is bounded.
- [ ] Language configuration exists.
- [ ] Page size is configurable.
- [ ] Timeout is configured.
- [ ] External response schema is validated.
- [ ] Google response is converted to an internal model.
- [ ] Fact-check candidate matching exists.
- [ ] Exact matches are supported.
- [ ] Near matches are handled conservatively.
- [ ] Negation mismatches are rejected.
- [ ] Number mismatches are rejected.
- [ ] Important entity mismatches are detected.
- [ ] External ratings are mapped to HaCha taxonomy.
- [ ] Unknown ratings are not blindly treated as false.
- [ ] Publisher attribution is preserved.
- [ ] Source URL is preserved.
- [ ] Review date is preserved where available.
- [ ] Claimant information is preserved where available.
- [ ] No-match does not become FALSE.
- [ ] API errors are distinguished from no-match.
- [ ] API failures do not create fake cache entries.
- [ ] Valid results are cached.
- [ ] Cached results bypass Google.
- [ ] Negative caching is handled conservatively if enabled.
- [ ] Google API calls occur only after Redis MISS.
- [ ] Metrics are recorded.
- [ ] Mocked API tests pass.
- [ ] Redis + Google integration test passes.
- [ ] A real previously fact-checked claim can return an attributed result.

---

# 86. Definition of Done

The Phase 7 definition of done is:

```text
                Confirmed Claim
                       ↓
                   Normalize
                       ↓
                    SHA-256
                       ↓
                 Redis Lookup
                 /           \
              HIT             MISS
               │                │
               ▼                ▼
        Cached Result      Google Fact Check
                                │
                       ┌────────┴────────┐
                       │                 │
                     MATCH            NO MATCH
                       │                 │
                       ▼                 ▼
                  Map Rating        Continue to
                       │             AI/RAG tier
                       ▼
                  Redis SET
                       │
                       ▼
                    Result
```

The critical safety requirement is:

> **A missing fact-check must never be interpreted as evidence that a claim is false.**

---

# 87. Suggested Git Commits

```text
feat(backend): add factcheck provider interface

feat(backend): add google factcheck client

feat(backend): add google api configuration

feat(backend): add factcheck response schemas

feat(backend): add factcheck response adapter

feat(backend): add claim matching service

feat(backend): add entity number and negation matching safeguards

feat(backend): add external rating mapper

feat(backend): integrate google factcheck provider

feat(backend): cache factcheck results

feat(backend): add negative factcheck cache policy

feat(backend): add factcheck provider metrics

test(backend): add google factcheck client tests

test(backend): add rating mapping tests

test(backend): add factcheck matching tests

test(backend): add provider failure tests

test(backend): add redis factcheck integration tests

docs(backend): document factcheck integration
```

---

# 88. Recommended Development Order

```text
Step 1
Create Google API credentials
        ↓
Step 2
Add environment configuration
        ↓
Step 3
Create FactCheckProvider interface
        ↓
Step 4
Create Google API client
        ↓
Step 5
Add timeout/error handling
        ↓
Step 6
Create response schemas
        ↓
Step 7
Create Google → internal model adapter
        ↓
Step 8
Create candidate matcher
        ↓
Step 9
Add number/entity/negation safeguards
        ↓
Step 10
Create rating mapper
        ↓
Step 11
Integrate provider into verification service
        ↓
Step 12
Test exact match
        ↓
Step 13
Test no match
        ↓
Step 14
Test incorrect/unknown ratings
        ↓
Step 15
Test mismatched numbers/entities/negation
        ↓
Step 16
Integrate Redis
        ↓
Step 17
Test MISS → Google → Redis SET
        ↓
Step 18
Test HIT → Google bypass
        ↓
Step 19
Measure match rate and latency
        ↓
Step 20
Phase 7 exit validation
```

---

# 89. Important Technical Decision

Keep Google behind an interface:

```text
FactCheckProvider
       │
       └── GoogleFactCheckProvider
```

Do not make the entire system depend directly on Google's response schema.

This allows future providers to be added without rewriting the verification pipeline.

---

# 90. Important Product Decision

**Source attribution is part of the verdict.**

HaCha should not simply display:

```text
FALSE
```

It should communicate:

```text
FALSE
According to [publisher]
[Read original fact-check]
```

This makes the system auditable and reduces the impression that HaCha itself is an unquestionable authority.

---

# 91. Important Safety Decision

Do not equate:

```text
No fact-check found
```

with:

```text
False
```

The correct interpretation is:

```text
No existing fact-check found.
```

That should route the claim toward the next verification tier.

---

# 92. Phase 7 → Phase 8 Handoff

Phase 7 produces:

```text
Claim
 ↓
Redis
 ↓
Google Fact Check
 ↓
Existing fact-check?
```

Phase 8 introduces the Python service:

```text
Node Gateway
      ↓
Python FastAPI
      ↓
Structured AI verification contract
```

At that point the architecture becomes:

```text
Redis
  ↓ MISS
Google Fact Check
  ↓ NO MATCH
AI Service
```

The Python service itself will initially be a skeleton.

---

# 93. Phase 7 → Phase 9/10 Relationship

The complete tiered system eventually becomes:

```text
                   Claim
                     │
                     ▼
                  Redis
                 /     \
               HIT     MISS
                │        │
                ▼        ▼
             Result   Google Fact Check
                         │
                    ┌────┴────┐
                  MATCH      NO MATCH
                    │           │
                    ▼           ▼
                 Result     Evidence Retrieval
                                │
                                ▼
                               RAG
                                │
                                ▼
                               LLM
                                │
                                ▼
                              Result
```

This is the core **tiered verification engine** described in the original project idea.

---

# 94. Final Phase 7 Summary

Phase 7 changes HaCha from:

```text
"Can we cache a claim?"
```

to:

```text
"Can we retrieve an existing fact-check before using AI?"
```

The architecture now becomes:

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
Claim identity
        ↓
Phase 6
Redis cache
        ↓
Phase 7
External fact-check verification
```

The key operational flow is:

```text
                USER CLAIM
                    │
                    ▼
              Local OCR
                    │
                    ▼
             User confirms
                    │
                    ▼
             Node.js Gateway
                    │
                    ▼
            Normalize + Hash
                    │
                    ▼
                 Redis
               /       \
             HIT       MISS
              │          │
              ▼          ▼
          Cached      Google
          Result     Fact Check
                         │
                    ┌────┴────┐
                  MATCH      NO MATCH
                    │           │
                    ▼           ▼
              Map external   Future RAG
                rating       + LLM tier
                    │
                    ▼
                 Redis
                    │
                    ▼
               Chrome UI
```

The major principle for this phase is:

> **Use existing fact-check evidence when it exists; do not spend AI inference on a claim that has already been independently reviewed.**

Phase 7 also establishes an important credibility rule:

> **HaCha must preserve the identity and attribution of the original fact-check publisher instead of presenting an external rating as an unexplained HaCha-generated truth.**

The next phase is **Phase 8 — AI Microservice Skeleton**, where the Python + FastAPI service will be introduced as the second verification layer and the Node.js gateway → Python service contract will be established.
