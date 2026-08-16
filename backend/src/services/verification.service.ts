/**
 * Verification Service - Phase 8 with AI Service Integration
 *
 * Implements the 3-tier verification cascade:
 * 1. Redis Cache → 2. Google Fact Check API → 3. Python AI Service (RAG+LLM)
 */
import { VerificationData, Verdict, SourceTier, VerificationSource } from "../types/api.js";
import { logger } from "../utils/logger.js";
import { normalizeClaim } from "./claim/claim-normalizer.js";
import { createClaimIdentity } from "./claim/claim-hasher.js";
import { initCacheService, getCachedVerification, setCachedVerification, getCacheConfig } from "./cache/redis-cache.service.js";
import { checkRedisHealth } from "./cache/redis.client.js";
import { connectRedis } from "./cache/redis.client.js";
import { env } from "../config/env.js";
import { getGoogleFactCheckClient } from "./factcheck/google-factcheck.client.js";
import { findBestMatch, isMatchReliable } from "./factcheck/factcheck.matcher.js";
import { mapFactCheckToVerdict, createVerificationSources, generateExplanation } from "./factcheck/factcheck.mapper.js";
import { ClaimMetadata } from "./claim/index.js";

/** Initialize cache service on module load */
const cacheConfig = {
  redisUrl: env.redisUrl,
  defaultTtlSeconds: env.cacheTtlSeconds,
  keyPrefix: env.cacheKeyPrefix,
  schemaVersion: env.cacheSchemaVersion as "v1",
  enabled: env.cacheEnabled,
  connectTimeoutMs: env.cacheConnectTimeoutMs,
  commandTimeoutMs: env.cacheCommandTimeoutMs,
  maxRetries: env.cacheMaxRetries,
};
initCacheService(cacheConfig);

/** Connect to Redis (non-blocking) */
let redisConnected = false;
connectRedis(cacheConfig)
  .then(() => {
    redisConnected = true;
    logger.info("Redis connected for verification service");
  })
  .catch((error) => {
    logger.warn("Redis connection failed, cache disabled", { error: error.message });
    redisConnected = false;
  });

/** Google Fact Check client (initialized lazily) */
let googleFactCheckClient: ReturnType<typeof getGoogleFactCheckClient> | null = null;

function getFactCheckClient() {
  if (!googleFactCheckClient && env.factCheckEnabled) {
    googleFactCheckClient = getGoogleFactCheckClient();
  }
  return googleFactCheckClient;
}

/**
 * Call Python AI Service for verification (Tier 3)
 * @returns Verification result or null if service unavailable/error
 */
async function callAiService(
  claim: string,
  claimHash: string,
  requestId: string,
  normalizedText: string
): Promise<{
  verdict: Verdict;
  confidence: number;
  explanation: string;
  sources: VerificationSource[];
  sourceTier: SourceTier;
} | null> {
  if (!env.aiServiceEnabled) {
    logger.debug("AI service disabled, skipping Tier 3", { requestId });
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.aiServiceTimeoutMs);

    const response = await fetch(`${env.aiServiceUrl}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.aiServiceToken}`,
      },
      body: JSON.stringify({
        claim,
        claim_hash: claimHash,
        language: env.factCheckLanguage,
        request_id: requestId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      logger.warn("AI service returned error", {
        requestId,
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data = await response.json();

    // Validate response structure
    if (!data.success || !data.data) {
      logger.warn("AI service returned invalid response", { requestId, data });
      return null;
    }

    const aiResult = data.data;

    // Map AI service verdict to our taxonomy
    const verdict = aiResult.verdict as Verdict;
    const confidence = typeof aiResult.confidence === "number" ? aiResult.confidence : 0;
    const explanation = aiResult.explanation || "AI service verification completed";
    const sources = Array.isArray(aiResult.sources)
      ? aiResult.sources.map((s: any) => ({
          title: s.title || "AI Service",
          url: s.url || "",
          publisher: s.publisher || "AI Service",
          publishDate: s.publish_date || new Date().toISOString(),
        }))
      : [];

    return {
      verdict,
      confidence,
      explanation,
      sources,
      sourceTier: "AI_RAG",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn("AI service timeout", { requestId, timeoutMs: env.aiServiceTimeoutMs });
    } else {
      logger.error("AI service call failed", { requestId, error: (error as Error).message });
    }
    return null;
  }
}

/**
 * Main verification function with 3-tier cascade:
 * Tier 1: Redis Cache → Tier 2: Google Fact Check API → Tier 3: Python AI Service (RAG+LLM)
 */
export async function verifyClaim(claim: string, requestId: string): Promise<VerificationData> {
  const startTime = Date.now();

  // Phase 5: Normalize and create claim identity
  const normalized = normalizeClaim(claim);
  const identity = await createClaimIdentity(normalized);
  const claimHash = identity.hash;

  // Log without sensitive content
  logger.debug("Verifying claim", {
    requestId,
    claimHash,
    normalizedLength: normalized.normalizedText.length,
    warnings: normalized.warnings,
  });

  // Phase 6: Check Redis cache first (Tier 1)
  const cacheResult = await getCachedVerification(claimHash);

  if (cacheResult.hit && cacheResult.verification) {
    const cached = cacheResult.verification;
    const durationMs = Date.now() - startTime;

    const result: VerificationData = {
      claimId: claimHash,
      normalizedClaim: cached.normalizedClaim,
      claimHash,
      normalizationVersion: identity.normalizationVersion,
      verdict: cached.verdict,
      confidence: cached.confidence,
      explanation: cached.explanation,
      sources: cached.sources,
      sourceTier: cached.sourceTier,
      cached: true,
      timestamp: new Date().toISOString(),
    };

    logger.logVerification(
      requestId,
      result.verdict,
      result.confidence,
      result.sourceTier,
      true, // cached
      durationMs
    );

    logger.debug("Cache hit - returning cached result", {
      requestId,
      claimHash,
      verdict: result.verdict,
      durationMs,
    });

    return result;
  }

  // Cache miss - Tier 2: Google Fact Check API
  logger.debug("Cache miss - calling Google Fact Check API (Tier 2)", { requestId, claimHash });

  let verificationResult: {
    verdict: Verdict;
    confidence: number;
    explanation: string;
    sources: VerificationSource[];
    sourceTier: SourceTier;
  };

  if (env.factCheckEnabled) {
    const client = getFactCheckClient();
    if (client) {
      const apiResult = await client.searchClaim(normalized.normalizedText, requestId);

      if (apiResult.status === "MATCH" && apiResult.results.length > 0) {
        // Find best match with safeguards
        const match = findBestMatch(
          normalized.normalizedText,
          normalized.metadata,
          apiResult.results,
          requestId
        );

        if (match && isMatchReliable(match.matchType)) {
          // Map to HaCha verdict
          const mapped = mapFactCheckToVerdict(
            match.matchedClaim,
            match.matchType,
            match.confidence,
            match.score
          );

          verificationResult = {
            verdict: mapped.verdict,
            confidence: mapped.confidence,
            explanation: mapped.explanation,
            sources: createVerificationSources(match.matchedClaim, match.matchType, mapped.verdict),
            sourceTier: "FACT_CHECK_API",
          };

          // Cache with normal TTL for matches
          await setCachedVerification(claimHash, {
            normalizedClaim: normalized.normalizedText,
            verdict: verificationResult.verdict,
            confidence: verificationResult.confidence,
            explanation: verificationResult.explanation,
            sources: verificationResult.sources,
            sourceTier: verificationResult.sourceTier,
          });
        } else {
          // No reliable match found - negative cache with shorter TTL
          verificationResult = {
            verdict: "UNVERIFIED",
            confidence: 0,
            explanation: match
              ? `Found fact-checks but none reliably match (best: ${match.matchType}, ${(match.confidence * 100).toFixed(1)}% confidence)`
              : "No fact-checks found matching this claim",
            sources: [],
            sourceTier: "FACT_CHECK_API",
          };

          // Negative caching with shorter TTL (FACTCHECK_NO_MATCH_TTL_SECONDS)
          await setCachedVerification(claimHash, {
            normalizedClaim: normalized.normalizedText,
            verdict: verificationResult.verdict,
            confidence: verificationResult.confidence,
            explanation: verificationResult.explanation,
            sources: verificationResult.sources,
            sourceTier: verificationResult.sourceTier,
          }, env.factCheckNoMatchTtlSeconds);
        }
      } else if (apiResult.status === "NO_MATCH") {
        // API returned no matches - negative cache
        verificationResult = {
          verdict: "UNVERIFIED",
          confidence: 0,
          explanation: "Google Fact Check API found no matching fact-checks",
          sources: [],
          sourceTier: "FACT_CHECK_API",
        };

        await setCachedVerification(claimHash, {
          normalizedClaim: normalized.normalizedText,
          verdict: verificationResult.verdict,
          confidence: verificationResult.confidence,
          explanation: verificationResult.explanation,
          sources: verificationResult.sources,
          sourceTier: verificationResult.sourceTier,
        }, env.factCheckNoMatchTtlSeconds);
      } else {
        // API error - don't cache, fall through to AI service (Phase 8+)
        logger.warn("Google Fact Check API error, will fallback", {
          requestId,
          errorCode: apiResult.errorCode,
          errorMessage: apiResult.errorMessage,
        });

        // For Phase 7, return UNVERIFIED with error info
        verificationResult = {
          verdict: "UNVERIFIED",
          confidence: 0,
          explanation: `Fact-check API error: ${apiResult.errorMessage}`,
          sources: [],
          sourceTier: "FACT_CHECK_API",
        };

        // Don't cache errors - allow retry on next request
      }
    } else {
      // Fact check disabled or client unavailable
      verificationResult = {
        verdict: "UNVERIFIED",
        confidence: 0,
        explanation: "Fact-check service not configured",
        sources: [],
        sourceTier: "FACT_CHECK_API",
      };
    }
  } else {
    // Fact check disabled
    verificationResult = {
      verdict: "UNVERIFIED",
      confidence: 0,
      explanation: "Fact-check service disabled",
      sources: [],
      sourceTier: "FACT_CHECK_API",
    };
  }

  // Phase 8+: Tier 3 - Python AI RAG Service
  // Only call if Tier 2 returned UNVERIFIED (no reliable match found)
  if (verificationResult.verdict === "UNVERIFIED" && verificationResult.confidence === 0) {
    logger.debug("Tier 2 returned UNVERIFIED, calling AI service (Tier 3)", { requestId, claimHash });

    const aiResult = await callAiService(claim, claimHash, requestId, normalized.normalizedText);

    if (aiResult) {
      // AI service returned a result - use it
      verificationResult = aiResult;

      // Cache with normal TTL for AI results
      await setCachedVerification(claimHash, {
        normalizedClaim: normalized.normalizedText,
        verdict: verificationResult.verdict,
        confidence: verificationResult.confidence,
        explanation: verificationResult.explanation,
        sources: verificationResult.sources,
        sourceTier: verificationResult.sourceTier,
      });
    } else {
      logger.debug("AI service unavailable or returned no result", { requestId, claimHash });
    }
  }

  const result: VerificationData = {
    claimId: claimHash,
    normalizedClaim: normalized.normalizedText,
    claimHash,
    normalizationVersion: identity.normalizationVersion,
    verdict: verificationResult.verdict,
    confidence: verificationResult.confidence,
    explanation: verificationResult.explanation,
    sources: verificationResult.sources,
    sourceTier: verificationResult.sourceTier,
    cached: false,
    timestamp: new Date().toISOString(),
  };

  const durationMs = Date.now() - startTime;
  logger.logVerification(
    requestId,
    result.verdict,
    result.confidence,
    result.sourceTier,
    result.cached,
    durationMs
  );

  return result;
}

/**
 * Health check for verification service dependencies.
 * Returns status of each tier.
 */
export async function checkVerificationHealth(): Promise<{
  redis: "healthy" | "unhealthy" | "not_configured";
  factCheckApi: "healthy" | "unhealthy" | "not_configured";
  aiService: "healthy" | "unhealthy" | "not_configured";
}> {
  const redisHealth = await checkRedisHealth();

  let factCheckHealth: "healthy" | "unhealthy" | "not_configured" = "not_configured";

  if (env.factCheckEnabled) {
    const client = getFactCheckClient();
    if (client) {
      const health = await client.healthCheck("health-check");
      factCheckHealth = health.healthy ? "healthy" : "unhealthy";
    } else {
      factCheckHealth = "unhealthy";
    }
  }

  let aiServiceHealth: "healthy" | "unhealthy" | "not_configured" = "not_configured";

  if (env.aiServiceEnabled) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${env.aiServiceUrl}/ready`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${env.aiServiceToken}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      aiServiceHealth = response.ok ? "healthy" : "unhealthy";
    } catch (error) {
      aiServiceHealth = "unhealthy";
    }
  }

  return {
    redis: redisHealth,
    factCheckApi: factCheckHealth,
    aiService: aiServiceHealth,
  };
}

/**
 * Check if Redis is available for caching.
 * @returns True if Redis is connected and cache is enabled
 */
export function isCacheAvailable(): boolean {
  return redisConnected && cacheConfig.enabled;
}