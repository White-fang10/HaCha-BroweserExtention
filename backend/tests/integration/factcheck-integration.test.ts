/**
 * Fact-Check Integration Tests - Phase 7
 * Tests the full flow: Redis MISS → Google Fact Check API → Redis SET → Redis HIT
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  ping: vi.fn().mockResolvedValue("PONG"),
  quit: vi.fn().mockResolvedValue("OK"),
  on: vi.fn(),
  isOpen: true,
};

vi.mock("../../src/services/cache/redis.client.js", () => ({
  getRedisClient: () => mockRedis,
  isRedisConnected: () => true,
  connectRedis: vi.fn().mockResolvedValue(undefined),
  checkRedisHealth: vi.fn().mockResolvedValue("healthy"),
}));

vi.mock("../../src/config/env.js", () => ({
  env: {
    nodeEnv: "test",
    port: 3000,
    extensionOrigin: "chrome-extension://*",
    corsOrigin: "chrome-extension://*",
    maxClaimLength: 5000,
    logLevel: "info",
    redisUrl: "redis://localhost:6379",
    mongodbUri: "mongodb://localhost:27017/hacha",
    aiServiceUrl: "http://localhost:8000",
    aiServiceToken: "development-secret",
    cacheTtlSeconds: 86400,
    cacheKeyPrefix: "hacha:claim",
    cacheSchemaVersion: "v1",
    cacheEnabled: true,
    cacheConnectTimeoutMs: 5000,
    cacheCommandTimeoutMs: 2000,
    cacheMaxRetries: 3,
    googleFactCheckApiKey: "test-api-key",
    factCheckEnabled: true,
    factCheckLanguage: "en",
    factCheckPageSize: 10,
    factCheckMaxAgeDays: null,
    factCheckTimeoutMs: 5000,
    factCheckNoMatchTtlSeconds: 900,
    aiServiceEnabled: false,
    aiServiceTimeoutMs: 30000,
  },
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logVerification: vi.fn(),
  },
}));

// Mock fetch for Google API - must be after env mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Now import the modules under test
import { verifyClaim, checkVerificationHealth } from "../../src/services/verification.service.js";
import { resetCacheMetrics } from "../../src/services/cache/redis-cache.service.js";

describe("Fact-Check Integration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetCacheMetrics();

    // Reset Redis mock
    mockRedis.get.mockReset();
    mockRedis.setex.mockResolvedValue("OK");
    mockRedis.del.mockResolvedValue(1);
    mockRedis.ping.mockResolvedValue("PONG");

    // Reset checkRedisHealth mock (clearAllMocks resets the implementation)
    const redisClientMock = await import("../../src/services/cache/redis.client.js");
    (redisClientMock.checkRedisHealth as any).mockResolvedValue("healthy");

    // Reset Google API client singleton
    (global as any).googleFactCheckClient = null;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return cached result on cache hit (Tier 1)", async () => {
    // Setup cached value - claimHash must be 64-char SHA-256 hex
    const claimHash = "a".repeat(64);
    const cachedValue = {
      schemaVersion: "v1",
      claimHash,
      normalizedClaim: "covid vaccines are safe",
      verdict: "SUPPORTED",
      confidence: 0.95,
      explanation: "Cached result from fact-check",
      sources: [{ title: "Test", url: "https://test.com", publisher: "Test", publishDate: "2023-01-01" }],
      sourceTier: "FACT_CHECK_API",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    mockRedis.get.mockResolvedValue(JSON.stringify(cachedValue));

    const result = await verifyClaim("COVID vaccines are safe", "req-123");

    expect(result.cached).toBe(true);
    expect(result.verdict).toBe("SUPPORTED");
    expect(result.sourceTier).toBe("FACT_CHECK_API");
    expect(mockRedis.get).toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled(); // Should not call API on cache hit
  });

  it("should call Google Fact Check API on cache miss and cache result", async () => {
    // Cache miss
    mockRedis.get.mockResolvedValue(null);

    // Google API returns a match
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        claims: [
          {
            text: "COVID vaccines are safe and effective",
            claimant: "Health authority",
            claimDate: "2023-01-15",
            claimReview: [
              {
                publisher: { name: "WHO Fact Check", site: "who.int" },
                url: "https://who.int/factcheck/vaccine-safety",
                title: "COVID-19 vaccines are safe",
                reviewDate: "2023-01-20",
                textualRating: "True",
              },
            ],
          },
        ],
      }),
    });

    const result = await verifyClaim("COVID vaccines are safe", "req-456");

    expect(result.cached).toBe(false);
    expect(result.verdict).toBe("SUPPORTED");
    expect(result.sourceTier).toBe("FACT_CHECK_API");
    expect(result.confidence).toBeGreaterThan(0.7); // Adjusted threshold
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockRedis.setex).toHaveBeenCalled(); // Should cache the result
  });

  it("should negative cache when no match found (shorter TTL)", async () => {
    mockRedis.get.mockResolvedValue(null);

    // Google API returns no matches
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ claims: [] }),
    });

    const result = await verifyClaim("Completely fake claim nobody checked", "req-789");

    expect(result.verdict).toBe("UNVERIFIED");
    expect(result.confidence).toBe(0);
    expect(result.sourceTier).toBe("FACT_CHECK_API");
    expect(mockRedis.setex).toHaveBeenCalled();

    // Check that setex was called with shorter TTL (factCheckNoMatchTtlSeconds = 900)
    const setexCalls = mockRedis.setex.mock.calls;
    expect(setexCalls.length).toBeGreaterThan(0);
    const [key, ttl, value] = setexCalls[0];
    expect(ttl).toBe(900); // Shorter TTL for negative cache
  });

  it("should negative cache when matches found but none reliable", async () => {
    mockRedis.get.mockResolvedValue(null);

    // Google API returns claims but they don't match well (negation mismatch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        claims: [
          {
            text: "COVID vaccines do NOT cause infertility", // Has negation
            claimant: "Health authority",
            claimDate: "2023-01-15",
            claimReview: [
              {
                publisher: { name: "WHO Fact Check", site: "who.int" },
                url: "https://who.int/factcheck/vaccine-infertility",
                title: "Vaccines don't cause infertility",
                reviewDate: "2023-01-20",
                textualRating: "True",
              },
            ],
          },
        ],
      }),
    });

    // User claim has NO negation but external claim HAS negation - should reject
    const result = await verifyClaim("COVID vaccines cause infertility", "req-999");

    expect(result.verdict).toBe("UNVERIFIED");
    expect(result.confidence).toBe(0);
    // The matcher returns null for negation mismatch (conservative approach),
    // so the explanation will be "No fact-checks found matching this claim"
    expect(result.explanation).toContain("No fact-checks found matching this claim");
    expect(mockRedis.setex).toHaveBeenCalled();

    // Should use shorter TTL for negative cache
    const setexCalls = mockRedis.setex.mock.calls;
    const [key, ttl, value] = setexCalls[0];
    expect(ttl).toBe(900);
  });

  it("should not cache API errors (allow retry)", async () => {
    mockRedis.get.mockResolvedValue(null);

    // Google API returns error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server error",
    });

    const result = await verifyClaim("Test claim", "req-error");

    expect(result.verdict).toBe("UNVERIFIED");
    expect(result.explanation).toContain("Fact-check API error");
    expect(mockRedis.setex).not.toHaveBeenCalled(); // Should NOT cache errors
  });

  it("should handle API timeout gracefully", async () => {
    mockRedis.get.mockResolvedValue(null);

    // Simulate timeout
    mockFetch.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

    const result = await verifyClaim("Test claim", "req-timeout");

    expect(result.verdict).toBe("UNVERIFIED");
    expect(result.explanation).toContain("Fact-check API error");
    expect(mockRedis.setex).not.toHaveBeenCalled();
  });

  it("should return proper health check status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const health = await checkVerificationHealth();

    expect(health.redis).toBe("healthy");
    expect(health.factCheckApi).toBe("healthy");
    expect(health.aiService).toBe("not_configured");
  });

  it("should handle consecutive cache miss then hit", async () => {
    // First request - cache miss
    mockRedis.get.mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        claims: [
          {
            text: "Test claim for consecutive test",
            claimReview: [
              {
                publisher: { name: "Test", site: "test.com" },
                url: "https://test.com/factcheck",
                title: "Test factcheck",
                reviewDate: "2023-01-01",
                textualRating: "True",
              },
            ],
          },
        ],
      }),
    });

    const result1 = await verifyClaim("Test claim for consecutive test", "req-consecutive-1");

    expect(result1.cached).toBe(false);
    expect(result1.verdict).toBe("SUPPORTED");

    // Second request - cache hit
    const cachedValue = {
      schemaVersion: "v1",
      claimHash: result1.claimHash,
      normalizedClaim: result1.normalizedClaim,
      verdict: "SUPPORTED",
      confidence: result1.confidence,
      explanation: result1.explanation,
      sources: result1.sources,
      sourceTier: "FACT_CHECK_API",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedValue));

    const result2 = await verifyClaim("Test claim for consecutive test", "req-consecutive-2");

    expect(result2.cached).toBe(true);
    expect(result2.verdict).toBe("SUPPORTED");
    expect(result2.claimId).toBe(result1.claimHash);
  });
});