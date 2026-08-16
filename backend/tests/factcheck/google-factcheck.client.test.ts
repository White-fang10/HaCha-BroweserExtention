/**
 * Google Fact Check Client Tests - Phase 7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GoogleFactCheckClient, getGoogleFactCheckClient } from "../../src/services/factcheck/google-factcheck.client.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment
vi.mock("../../src/config/env.js", () => ({
  env: {
    googleFactCheckApiKey: "test-api-key",
    factCheckTimeoutMs: 5000,
    factCheckLanguage: "en",
    factCheckPageSize: 10,
    factCheckMaxAgeDays: null,
  },
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("GoogleFactCheckClient", () => {
  let client: GoogleFactCheckClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleFactCheckClient();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("searchClaim", () => {
    it("should return ERROR when API key is missing", async () => {
      // Create client with empty API key
      const clientNoKey = new GoogleFactCheckClient();
      // Manually set apiKey to empty to simulate missing key
      (clientNoKey as any).apiKey = "";

      const result = await clientNoKey.searchClaim("test claim", "req-123");

      expect(result.status).toBe("ERROR");
      expect(result.errorCode).toBe("MISSING_API_KEY");
      expect(result.results).toEqual([]);
    });

    it("should return MATCH with parsed results on successful API response", async () => {
      const mockResponse = {
        claims: [
          {
            text: "COVID-19 vaccines cause infertility",
            claimant: "Social media post",
            claimDate: "2021-03-15",
            claimReview: [
              {
                publisher: { name: "Reuters Fact Check", site: "reuters.com" },
                url: "https://www.reuters.com/article/factcheck-vaccine-infertility",
                title: "Fact check: COVID-19 vaccines do not cause infertility",
                reviewDate: "2021-03-20",
                textualRating: "False",
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchClaim("COVID vaccines cause infertility", "req-123");

      expect(result.status).toBe("MATCH");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].claimText).toBe("COVID-19 vaccines cause infertility");
      expect(result.results[0].review.textualRating).toBe("False");
      expect(result.results[0].publisher.name).toBe("Reuters Fact Check");
    });

    it("should return NO_MATCH when API returns empty claims", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ claims: [] }),
      });

      const result = await client.searchClaim("nonexistent claim", "req-123");

      expect(result.status).toBe("NO_MATCH");
      expect(result.results).toEqual([]);
    });

    it("should return ERROR on 401 Unauthorized", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid API key",
      });

      const result = await client.searchClaim("test claim", "req-123");

      expect(result.status).toBe("ERROR");
      expect(result.errorCode).toBe("AUTH_ERROR");
    });

    it("should return ERROR on 429 Quota Exceeded", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () => "Quota exceeded",
      });

      const result = await client.searchClaim("test claim", "req-123");

      expect(result.status).toBe("ERROR");
      expect(result.errorCode).toBe("QUOTA_EXCEEDED");
    });

    it("should return ERROR on 500 Server Error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error",
      });

      const result = await client.searchClaim("test claim", "req-123");

      expect(result.status).toBe("ERROR");
      expect(result.errorCode).toBe("SERVER_ERROR");
    });

    it("should return ERROR on timeout", async () => {
      // Mock fetch to hang (simulate timeout)
      mockFetch.mockImplementationOnce(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 100)
        )
      );

      const result = await client.searchClaim("test claim", "req-123");

      expect(result.status).toBe("ERROR");
      expect(result.errorCode).toBe("TIMEOUT");
    });

    it("should return ERROR on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await client.searchClaim("test claim", "req-123");

      expect(result.status).toBe("ERROR");
      expect(result.errorCode).toBe("NETWORK_ERROR");
    });

    it("should skip invalid claims in response", async () => {
      const mockResponse = {
        claims: [
          {
            // Missing required fields - should be skipped
            claimReview: [],
          },
          {
            text: "Valid claim",
            claimReview: [
              {
                publisher: { name: "Publisher" },
                url: "https://example.com/factcheck",
                textualRating: "True",
              },
            ],
          },
          {
            text: "Another valid claim",
            claimReview: [
              {
                publisher: { name: "Publisher2" },
                url: "https://example.com/factcheck2",
                textualRating: "False",
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchClaim("test claim", "req-123");

      expect(result.status).toBe("MATCH");
      expect(result.results).toHaveLength(2);
    });
  });

  describe("healthCheck", () => {
    it("should return unhealthy when API key not configured", async () => {
      const clientNoKey = new GoogleFactCheckClient();
      (clientNoKey as any).apiKey = "";

      const result = await clientNoKey.healthCheck("health-123");

      expect(result.healthy).toBe(false);
      expect(result.error).toBe("API key not configured");
    });

    it("should return healthy when API responds OK", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await client.healthCheck("health-123");

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeDefined();
    });

    it("should return healthy on 400 (API reachable but bad query)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const result = await client.healthCheck("health-123");

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBeDefined();
    });

    it("should return unhealthy on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await client.healthCheck("health-123");

      expect(result.healthy).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });
  });

  describe("buildSearchQuery", () => {
    it("should return original claim if under max length", async () => {
      // Access private method via bracket notation for testing
      const query = (client as any).buildSearchQuery("short claim");

      expect(query).toBe("short claim");
    });

    it("should truncate long claims preserving start and end", async () => {
      const longClaim = "a".repeat(2500);
      const query = (client as any).buildSearchQuery(longClaim);

      expect(query.length).toBeLessThanOrEqual(2020); // 1000 + 3 + 1000 + some buffer
      expect(query).toContain("a".repeat(1000));
      expect(query).toContain("...");
    });
  });
});

describe("getGoogleFactCheckClient singleton", () => {
  it("should return same instance on multiple calls", () => {
    const client1 = getGoogleFactCheckClient();
    const client2 = getGoogleFactCheckClient();

    expect(client1).toBe(client2);
  });
});