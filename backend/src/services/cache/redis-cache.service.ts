/**
 * Redis Cache Service - Phase 6
 *
 * Provides cache-aside pattern operations for claim verification results.
 * Handles serialization, schema validation, TTL, and metrics.
 */

import { getRedisClient, isRedisConnected } from "./redis.client.js";
import { createCacheKey, parseCacheKey } from "./cache-key.js";
import {
  CacheConfig,
  CachedVerification,
  CacheGetResult,
  CacheSetResult,
  CacheMetrics,
} from "../../types/cache.js";
import { logger } from "../../utils/logger.js";

/** In-memory metrics (in production, use a proper metrics library) */
const metrics: CacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  setSuccess: 0,
  setFailures: 0,
  totalLookupLatencyMs: 0,
  totalWriteLatencyMs: 0,
};

/** Configuration instance */
let cacheConfig: CacheConfig | null = null;

/**
 * Initialize cache service with configuration.
 * @param config - Cache configuration
 */
export function initCacheService(config: CacheConfig): void {
  cacheConfig = config;
  logger.info("Cache service initialized", {
    keyPrefix: config.keyPrefix,
    defaultTtlSeconds: config.defaultTtlSeconds,
    schemaVersion: config.schemaVersion,
    enabled: config.enabled,
  });
}

/**
 * Get current cache configuration.
 * @returns Cache configuration or null if not initialized
 */
export function getCacheConfig(): CacheConfig | null {
  return cacheConfig;
}

/**
 * Validate a cached verification object against schema.
 * @param value - Parsed JSON object
 * @returns True if valid
 */
function validateCachedVerification(value: unknown): value is CachedVerification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const v = value as Record<string, unknown>;

  // Required fields
  if (typeof v.schemaVersion !== "string") return false;
  if (typeof v.claimHash !== "string" || v.claimHash.length !== 64) return false;
  if (typeof v.normalizedClaim !== "string") return false;
  if (typeof v.verdict !== "string") return false;
  if (typeof v.confidence !== "number" || v.confidence < 0 || v.confidence > 1) return false;
  if (typeof v.explanation !== "string") return false;
  if (!Array.isArray(v.sources)) return false;
  if (typeof v.sourceTier !== "string") return false;
  if (typeof v.createdAt !== "string") return false;
  if (typeof v.expiresAt !== "string") return false;

  // Validate verdict enum
  const validVerdicts = ["SUPPORTED", "FALSE", "MISLEADING", "UNVERIFIED"];
  if (!validVerdicts.includes(v.verdict)) return false;

  // Validate source tier
  const validTiers = ["REDIS_CACHE", "FACT_CHECK_API", "AI_RAG"];
  if (!validTiers.includes(v.sourceTier)) return false;

  // Validate dates are valid ISO strings
  if (isNaN(Date.parse(v.createdAt))) return false;
  if (isNaN(Date.parse(v.expiresAt))) return false;

  // Validate sources array
  for (const source of v.sources) {
    if (
      typeof source !== "object" ||
      !source ||
      typeof (source as Record<string, unknown>).title !== "string" ||
      typeof (source as Record<string, unknown>).url !== "string" ||
      typeof (source as Record<string, unknown>).publisher !== "string" ||
      typeof (source as Record<string, unknown>).publishDate !== "string"
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Get a cached verification result.
 * @param claimHash - SHA-256 hash of normalized claim
 * @returns Cache get result with hit/miss and verification data
 */
export async function getCachedVerification(claimHash: string): Promise<CacheGetResult> {
  const startTime = Date.now();

  if (!cacheConfig?.enabled) {
    return {
      hit: false,
      verification: null,
      lookupDurationMs: Date.now() - startTime,
    };
  }

  if (!isRedisConnected()) {
    metrics.errors++;
    logger.warn("Cache get skipped: Redis not connected", { claimHash });
    return {
      hit: false,
      verification: null,
      lookupDurationMs: Date.now() - startTime,
    };
  }

  const client = getRedisClient();
  if (!client) {
    metrics.errors++;
    return {
      hit: false,
      verification: null,
      lookupDurationMs: Date.now() - startTime,
    };
  }

  const key = createCacheKey(claimHash, cacheConfig.schemaVersion);

  try {
    const value = await client.get(key);
    const durationMs = Date.now() - startTime;
    metrics.totalLookupLatencyMs += durationMs;

    if (!value) {
      metrics.misses++;
      logger.debug("Cache miss", { claimHash, key, durationMs });
      return {
        hit: false,
        verification: null,
        lookupDurationMs: durationMs,
      };
    }

    // Parse and validate
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch (parseError) {
      metrics.errors++;
      logger.warn("Cache invalid JSON, treating as miss", { claimHash, key, error: (parseError as Error).message });
      // Optionally delete invalid key
      await client.del(key).catch(() => {});
      return {
        hit: false,
        verification: null,
        lookupDurationMs: durationMs,
      };
    }

    if (!validateCachedVerification(parsed)) {
      metrics.errors++;
      logger.warn("Cache schema validation failed, treating as miss", { claimHash, key });
      await client.del(key).catch(() => {});
      return {
        hit: false,
        verification: null,
        lookupDurationMs: durationMs,
      };
    }

    // Check expiration (defense in depth - Redis TTL should handle this)
    if (Date.now() > Date.parse(parsed.expiresAt)) {
      metrics.misses++;
      logger.debug("Cache entry expired", { claimHash, key });
      await client.del(key).catch(() => {});
      return {
        hit: false,
        verification: null,
        lookupDurationMs: durationMs,
      };
    }

    metrics.hits++;
    logger.debug("Cache hit", { claimHash, key, durationMs });

    return {
      hit: true,
      verification: parsed,
      lookupDurationMs: durationMs,
    };
  } catch (error) {
    metrics.errors++;
    const durationMs = Date.now() - startTime;
    metrics.totalLookupLatencyMs += durationMs;
    logger.error("Cache get error", { claimHash, key, error: (error as Error).message });
    return {
      hit: false,
      verification: null,
      lookupDurationMs: durationMs,
    };
  }
}

/**
 * Set a cached verification result.
 * @param claimHash - SHA-256 hash of normalized claim
 * @param verification - Verification data to cache
 * @param ttlSeconds - TTL override (optional, uses default from config)
 * @returns Cache set result
 */
export async function setCachedVerification(
  claimHash: string,
  verification: Omit<CachedVerification, "schemaVersion" | "claimHash" | "createdAt" | "expiresAt">,
  ttlSeconds?: number
): Promise<CacheSetResult> {
  const startTime = Date.now();

  if (!cacheConfig?.enabled) {
    return {
      success: false,
      writeDurationMs: Date.now() - startTime,
    };
  }

  if (!isRedisConnected()) {
    metrics.errors++;
    metrics.setFailures++;
    logger.warn("Cache set skipped: Redis not connected", { claimHash });
    return {
      success: false,
      writeDurationMs: Date.now() - startTime,
    };
  }

  const client = getRedisClient();
  if (!client) {
    metrics.setFailures++;
    return {
      success: false,
      writeDurationMs: Date.now() - startTime,
    };
  }

  const key = createCacheKey(claimHash, cacheConfig.schemaVersion);
  const ttl = ttlSeconds ?? cacheConfig.defaultTtlSeconds;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  const cachedValue: CachedVerification = {
    schemaVersion: cacheConfig.schemaVersion,
    claimHash,
    normalizedClaim: verification.normalizedClaim,
    verdict: verification.verdict,
    confidence: verification.confidence,
    explanation: verification.explanation,
    sources: verification.sources,
    sourceTier: verification.sourceTier,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  try {
    const serialized = JSON.stringify(cachedValue);
    await client.setex(key, ttl, serialized);

    const durationMs = Date.now() - startTime;
    metrics.totalWriteLatencyMs += durationMs;
    metrics.setSuccess++;

    logger.debug("Cache set", { claimHash, key, ttl, durationMs });

    return {
      success: true,
      writeDurationMs: durationMs,
    };
  } catch (error) {
    metrics.errors++;
    metrics.setFailures++;
    const durationMs = Date.now() - startTime;
    metrics.totalWriteLatencyMs += durationMs;
    logger.error("Cache set error", { claimHash, key, error: (error as Error).message });
    return {
      success: false,
      writeDurationMs: durationMs,
    };
  }
}

/**
 * Delete a cached verification.
 * @param claimHash - SHA-256 hash of normalized claim
 * @returns True if deleted
 */
export async function deleteCachedVerification(claimHash: string): Promise<boolean> {
  if (!cacheConfig?.enabled || !isRedisConnected()) {
    return false;
  }

  const client = getRedisClient();
  if (!client) {
    return false;
  }

  const key = createCacheKey(claimHash, cacheConfig.schemaVersion);

  try {
    const result = await client.del(key);
    logger.debug("Cache delete", { claimHash, key, deleted: result > 0 });
    return result > 0;
  } catch (error) {
    metrics.errors++;
    logger.error("Cache delete error", { claimHash, key, error: (error as Error).message });
    return false;
  }
}

/**
 * Invalidate (delete) a cached verification - developer utility.
 * @param claimHash - SHA-256 hash of normalized claim
 * @returns True if deleted
 */
export async function invalidateClaim(claimHash: string): Promise<boolean> {
  return deleteCachedVerification(claimHash);
}

/**
 * Get current cache metrics.
 * @returns Cache metrics snapshot
 */
export function getCacheMetrics(): CacheMetrics {
  return { ...metrics };
}

/**
 * Reset cache metrics (useful for testing).
 */
export function resetCacheMetrics(): void {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.errors = 0;
  metrics.setSuccess = 0;
  metrics.setFailures = 0;
  metrics.totalLookupLatencyMs = 0;
  metrics.totalWriteLatencyMs = 0;
}

/**
 * Calculate cache hit ratio.
 * @returns Hit ratio (0-1) or null if no requests
 */
export function getCacheHitRatio(): number | null {
  const total = metrics.hits + metrics.misses;
  if (total === 0) return null;
  return metrics.hits / total;
}

/**
 * Get average lookup latency in ms.
 * @returns Average latency or null if no lookups
 */
export function getAverageLookupLatency(): number | null {
  const total = metrics.hits + metrics.misses;
  if (total === 0) return null;
  return metrics.totalLookupLatencyMs / total;
}

/**
 * Get average write latency in ms.
 * @returns Average latency or null if no writes
 */
export function getAverageWriteLatency(): number | null {
  const total = metrics.setSuccess + metrics.setFailures;
  if (total === 0) return null;
  return metrics.totalWriteLatencyMs / total;
}