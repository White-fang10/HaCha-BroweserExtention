/**
 * Redis Cache Integration Tests - Phase 6
 * Tests for Redis cache operations.
 *
 * Note: These tests require a running Redis instance at redis://localhost:6379
 * Run with: docker-compose up -d redis
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initCacheService,
  getCachedVerification,
  setCachedVerification,
  deleteCachedVerification,
  invalidateClaim,
  getCacheMetrics,
  resetCacheMetrics,
  getCacheHitRatio,
  getAverageLookupLatency,
  getAverageWriteLatency,
  getCacheConfig,
} from "../../src/services/cache/redis-cache.service.js";
import { connectRedis, closeRedis, checkRedisHealth, isRedisConnected } from "../../src/services/cache/redis.client.js";
import { env } from "../../src/config/env.js";

// Test configuration
const testConfig = {
  redisUrl: env.redisUrl,
  defaultTtlSeconds: 2, // Very short TTL for expiration tests
  keyPrefix: env.cacheKeyPrefix,
  schemaVersion: env.cacheSchemaVersion,
  enabled: true,
  connectTimeoutMs: 5000,
  commandTimeoutMs: 2000,
  maxRetries: 3,
};

// Test claim hash
const TEST_HASH = "a".repeat(64);
const TEST_HASH_2 = "b".repeat(64);

// Sample verification data
const sampleVerification = {
  normalizedClaim: "nasa confirms earth will experience three days of darkness",
  verdict: "FALSE" as const,
  confidence: 0.95,
  explanation: "No scientific evidence supports this claim.",
  sources: [
    {
      title: "NASA Fact Check",
      url: "https://nasa.gov/factcheck",
      publisher: "NASA",
      publishDate: "2024-01-15T00:00:00.000Z",
      reliabilityScore: 0.99,
    },
  ],
  sourceTier: "FACT_CHECK_API" as const,
};

describe("Redis Cache Integration", () => {
  let redisAvailable = false;

  beforeAll(async () => {
    // Try to connect to Redis
    try {
      await connectRedis(testConfig);
      redisAvailable = isRedisConnected();
      if (redisAvailable) {
        initCacheService(testConfig);
        console.log("Redis connected - running integration tests");
      } else {
        console.log("Redis not available - skipping integration tests");
      }
    } catch (error) {
      console.log("Redis connection failed - skipping integration tests", error);
      redisAvailable = false;
    }
  }, 10000);

  afterAll(async () => {
    if (redisAvailable) {
      await closeRedis();
    }
  });

  beforeEach(async () => {
    if (!redisAvailable) return;
    resetCacheMetrics();
    // Clean up any test keys
    await deleteCachedVerification(TEST_HASH);
    await deleteCachedVerification(TEST_HASH_2);
  });

  describe("Connection", () => {
    it("should report Redis health", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      const health = await checkRedisHealth();
      expect(health).toBe("healthy");
    });

    it("should report connection status", () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      expect(isRedisConnected()).toBe(true);
    });
  });

  describe("Cache Configuration", () => {
    it("should have correct configuration", () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      const config = getCacheConfig();
      expect(config).not.toBeNull();
      expect(config!.redisUrl).toBe(testConfig.redisUrl);
      expect(config!.defaultTtlSeconds).toBe(testConfig.defaultTtlSeconds);
      expect(config!.schemaVersion).toBe(testConfig.schemaVersion);
      expect(config!.enabled).toBe(true);
    });
  });

  describe("Cache Miss", () => {
    it("should return miss for non-existent key", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      const result = await getCachedVerification(TEST_HASH);
      expect(result.hit).toBe(false);
      expect(result.verification).toBeNull();
      expect(result.lookupDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should increment miss metric", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      const metricsBefore = getCacheMetrics();
      await getCachedVerification(TEST_HASH);
      const metricsAfter = getCacheMetrics();
      expect(metricsAfter.misses).toBe(metricsBefore.misses + 1);
    });
  });

  describe("Cache Set and Get", () => {
    it("should set and get a verification result", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      // Set
      const setResult = await setCachedVerification(TEST_HASH, sampleVerification);
      expect(setResult.success).toBe(true);
      expect(setResult.writeDurationMs).toBeGreaterThanOrEqual(0);

      // Get
      const getResult = await getCachedVerification(TEST_HASH);
      expect(getResult.hit).toBe(true);
      expect(getResult.verification).not.toBeNull();
      expect(getResult.verification!.normalizedClaim).toBe(sampleVerification.normalizedClaim);
      expect(getResult.verification!.verdict).toBe(sampleVerification.verdict);
      expect(getResult.verification!.confidence).toBe(sampleVerification.confidence);
      expect(getResult.verification!.explanation).toBe(sampleVerification.explanation);
      expect(getResult.verification!.sources).toEqual(sampleVerification.sources);
      expect(getResult.verification!.sourceTier).toBe(sampleVerification.sourceTier);
      expect(getResult.verification!.claimHash).toBe(TEST_HASH);
      expect(getResult.verification!.schemaVersion).toBe(testConfig.schemaVersion);
      expect(new Date(getResult.verification!.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
      expect(new Date(getResult.verification!.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("should increment hit metric on successful get", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      await setCachedVerification(TEST_HASH, sampleVerification);
      const metricsBefore = getCacheMetrics();
      await getCachedVerification(TEST_HASH);
      const metricsAfter = getCacheMetrics();
      expect(metricsAfter.hits).toBe(metricsBefore.hits + 1);
    });

    it("should increment set success metric", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      const metricsBefore = getCacheMetrics();
      await setCachedVerification(TEST_HASH, sampleVerification);
      const metricsAfter = getCacheMetrics();
      expect(metricsAfter.setSuccess).toBe(metricsBefore.setSuccess + 1);
    });
  });

  describe("TTL Expiration", () => {
    it("should expire after TTL", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      // Set with 2 second TTL
      await setCachedVerification(TEST_HASH, sampleVerification, 2);

      // Should be available immediately
      const immediate = await getCachedVerification(TEST_HASH);
      expect(immediate.hit).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Should be expired
      const expired = await getCachedVerification(TEST_HASH);
      expect(expired.hit).toBe(false);
    });
  });

  describe("Cache Delete", () => {
    it("should delete a cached entry", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      await setCachedVerification(TEST_HASH, sampleVerification);
      const deleted = await deleteCachedVerification(TEST_HASH);
      expect(deleted).toBe(true);

      const result = await getCachedVerification(TEST_HASH);
      expect(result.hit).toBe(false);
    });

    it("should return false for deleting non-existent key", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      const deleted = await deleteCachedVerification("c".repeat(64));
      expect(deleted).toBe(false);
    });
  });

  describe("Cache Invalidate", () => {
    it("should invalidate a claim", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      await setCachedVerification(TEST_HASH, sampleVerification);
      const invalidated = await invalidateClaim(TEST_HASH);
      expect(invalidated).toBe(true);

      const result = await getCachedVerification(TEST_HASH);
      expect(result.hit).toBe(false);
    });
  });

  describe("Different Claims", () => {
    it("should store different claims separately", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      const verification2 = {
        ...sampleVerification,
        normalizedClaim: "esa confirms mars discovery",
        verdict: "SUPPORTED" as const,
      };

      await setCachedVerification(TEST_HASH, sampleVerification);
      await setCachedVerification(TEST_HASH_2, verification2);

      const result1 = await getCachedVerification(TEST_HASH);
      const result2 = await getCachedVerification(TEST_HASH_2);

      expect(result1.hit).toBe(true);
      expect(result2.hit).toBe(true);
      expect(result1.verification!.normalizedClaim).toBe(sampleVerification.normalizedClaim);
      expect(result2.verification!.normalizedClaim).toBe(verification2.normalizedClaim);
      expect(result1.verification!.verdict).toBe("FALSE");
      expect(result2.verification!.verdict).toBe("SUPPORTED");
    });
  });

  describe("Cache Metrics", () => {
    it("should track hit ratio", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      resetCacheMetrics();

      // 1 miss
      await getCachedVerification(TEST_HASH);
      // 1 hit
      await setCachedVerification(TEST_HASH, sampleVerification);
      await getCachedVerification(TEST_HASH);

      const hitRatio = getCacheHitRatio();
      expect(hitRatio).toBe(0.5);
    });

    it("should track average lookup latency", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      resetCacheMetrics();

      await getCachedVerification(TEST_HASH); // miss
      await setCachedVerification(TEST_HASH, sampleVerification);
      await getCachedVerification(TEST_HASH); // hit

      const avgLatency = getAverageLookupLatency();
      expect(avgLatency).toBeGreaterThan(0);
    });

    it("should track average write latency", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      resetCacheMetrics();

      await setCachedVerification(TEST_HASH, sampleVerification);

      const avgWriteLatency = getAverageWriteLatency();
      expect(avgWriteLatency).toBeGreaterThan(0);
    });
  });

  describe("Disabled Cache", () => {
    it("should return miss when cache is disabled", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      // Re-init with disabled
      const disabledConfig = { ...testConfig, enabled: false };
      initCacheService(disabledConfig);

      const result = await getCachedVerification(TEST_HASH);
      expect(result.hit).toBe(false);

      const setResult = await setCachedVerification(TEST_HASH, sampleVerification);
      expect(setResult.success).toBe(false);

      // Re-enable
      initCacheService(testConfig);
    });
  });

  describe("Schema Validation", () => {
    it("should reject invalid cached data", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      // Manually insert invalid JSON
      const client = (await import("../../src/services/cache/redis.client.js")).getRedisClient();
      if (client) {
        const key = `hacha:claim:${testConfig.schemaVersion}:${TEST_HASH}`;
        await client.set(key, "{invalid json");

        const result = await getCachedVerification(TEST_HASH);
        // Should treat as miss and clean up
        expect(result.hit).toBe(false);
      }
    });

    it("should reject cached data with wrong schema", async () => {
      if (!redisAvailable) {
        console.log("Skipping: Redis not available");
        return;
      }
      // Insert data with missing required fields
      const client = (await import("../../src/services/cache/redis.client.js")).getRedisClient();
      if (client) {
        const key = `hacha:claim:${testConfig.schemaVersion}:${TEST_HASH}`;
        await client.set(key, JSON.stringify({ invalid: "data" }));

        const result = await getCachedVerification(TEST_HASH);
        expect(result.hit).toBe(false);
      }
    });
  });
});