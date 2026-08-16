/**
 * Verification Service - Phase 6 with Redis Cache
 *
 * Implements the cache-aside pattern:
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

/**
 * Main verification function with Redis cache integration.
 * Implements cache-aside pattern.
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

  // Cache miss - proceed to stub verification (will be replaced by real tiers in Phase 7+)
  logger.debug("Cache miss - proceeding to verification", { requestId, claimHash });

  // TODO Phase 7: Call Google Fact Check API
  // TODO Phase 8+: Call Python AI RAG service

  // For now, return UNVERIFIED (stub)
  const verificationResult = {
    verdict: "UNVERIFIED" as Verdict,
    confidence: 0,
    explanation: "Verification service not yet implemented. This is a stub response.",
    sources: [] as VerificationSource[],
    sourceTier: "AI_RAG" as SourceTier, // Will be determined by actual tier that responds
  };

  // Cache the result for future requests
  await setCachedVerification(claimHash, {
    normalizedClaim: normalized.normalizedText,
    verdict: verificationResult.verdict,
    confidence: verificationResult.confidence,
    explanation: verificationResult.explanation,
    sources: verificationResult.sources,
    sourceTier: verificationResult.sourceTier,
  });

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

  return {
    redis: redisHealth,
    factCheckApi: "not_configured",
    aiService: "not_configured",
  };
}

/**
 * Check if Redis is available for caching.
 * @returns True if Redis is connected and cache is enabled
 */
export function isCacheAvailable(): boolean {
  return redisConnected && cacheConfig.enabled;
}