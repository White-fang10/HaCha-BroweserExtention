/**
 * Hashing Tests - Phase 5
 * Tests for SHA-256 claim hashing
 */

import { describe, it, expect } from "vitest";
import { hashClaim, createShortHash, isValidHash, createClaimIdentity, createCacheKey, parseCacheKey } from "../../src/services/claim/claim-hasher.js";
import { normalizeClaim } from "../../src/services/claim/claim-normalizer.js";
import { NORMALIZATION_VERSION } from "../../src/types/claim.js";

describe("Claim Hashing", () => {
  describe("SHA-256 Hash Generation", () => {
    it("should produce 64-character hex string", async () => {
      const hash = await hashClaim("nasa confirms earth");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should be deterministic - same input produces same hash", async () => {
      const hash1 = await hashClaim("nasa confirms earth");
      const hash2 = await hashClaim("nasa confirms earth");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", async () => {
      const hash1 = await hashClaim("nasa confirms earth");
      const hash2 = await hashClaim("esa confirms earth");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce same hash after normalization of case variations", async () => {
      // hashClaim operates on normalized text, so different casing is different hash
      const hashA = await hashClaim("nasa confirms earth");
      const hashB = await hashClaim("NASA CONFIRMS EARTH");
      expect(hashA).not.toBe(hashB);

      // But through the normalization pipeline, both produce the same hash
      const normalizedA = normalizeClaim("nasa confirms earth");
      const normalizedB = normalizeClaim("NASA CONFIRMS EARTH");
      const hashNormA = await hashClaim(normalizedA.normalizedText);
      const hashNormB = await hashClaim(normalizedB.normalizedText);
      expect(hashNormA).toBe(hashNormB);
    });

    it("should produce different hashes for 20% vs 30%", async () => {
      const hash1 = await hashClaim("vaccine is 20% effective");
      const hash2 = await hashClaim("vaccine is 30% effective");
      expect(hash1).not.toBe(hash2);
    });

    it("should produce different hashes for negation", async () => {
      const hash1 = await hashClaim("earth is flat");
      const hash2 = await hashClaim("earth is not flat");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Short Hash", () => {
    it("should produce 16-character prefix", async () => {
      const shortHash = await createShortHash("nasa confirms earth");
      expect(shortHash).toHaveLength(16);
    });

    it("should match prefix of full hash", async () => {
      const fullHash = await hashClaim("nasa confirms earth");
      const shortHash = await createShortHash("nasa confirms earth");
      expect(fullHash.startsWith(shortHash)).toBe(true);
    });
  });

  describe("Hash Validation", () => {
    it("should validate correct 64-char hex", () => {
      expect(isValidHash("a".repeat(64))).toBe(true);
      expect(isValidHash("0123456789abcdef".repeat(4))).toBe(true);
    });

    it("should reject non-hex characters", () => {
      expect(isValidHash("g".repeat(64))).toBe(false);
    });

    it("should reject wrong length", () => {
      expect(isValidHash("a".repeat(63))).toBe(false);
      expect(isValidHash("a".repeat(65))).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidHash("")).toBe(false);
    });
  });

  describe("Claim Identity Creation", () => {
    it("should create complete ClaimIdentity", async () => {
      const normalized = normalizeClaim("NASA confirms Earth");
      const identity = await createClaimIdentity(normalized);

      expect(identity.originalText).toBe("NASA confirms Earth");
      expect(identity.normalizedText).toBe("nasa confirms earth");
      expect(identity.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(identity.normalizationVersion).toBe(NORMALIZATION_VERSION);
      expect(identity.warnings).toEqual([]);
      expect(identity.metadata).toBeDefined();
    });

    it("should include warnings in identity", async () => {
      const normalized = normalizeClaim("NASA confirms Earth 🚀");
      const identity = await createClaimIdentity(normalized);

      expect(identity.warnings).toContain("Decorative emoji removed from canonical claim");
    });

    it("should include metadata in identity", async () => {
      const normalized = normalizeClaim("NASA confirms Earth #space @news https://nasa.gov");
      const identity = await createClaimIdentity(normalized);

      expect(identity.metadata.hashtags).toContain("space");
      expect(identity.metadata.mentions).toContain("news");
      expect(identity.metadata.urls).toContain("https://nasa.gov");
    });
  });

  describe("Cache Key Generation", () => {
    it("should create proper cache key format", () => {
      const key = createCacheKey("a".repeat(64));
      expect(key).toBe(`hacha:claim:${NORMALIZATION_VERSION}:${"a".repeat(64)}`);
    });

    it("should parse cache key correctly", () => {
      const hash = "a".repeat(64);
      const key = createCacheKey(hash);
      const parsed = parseCacheKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed!.version).toBe(NORMALIZATION_VERSION);
      expect(parsed!.hash).toBe(hash);
    });

    it("should reject invalid cache key format", () => {
      expect(parseCacheKey("invalid:key")).toBeNull();
      expect(parseCacheKey("hacha:claim:v1:short")).toBeNull();
      expect(parseCacheKey("other:prefix:v1:" + "a".repeat(64))).toBeNull();
    });
  });

  describe("End-to-End Determinism", () => {
    it("should produce identical hashes for equivalent formatted claims", async () => {
      const claims = [
        "NASA CONFIRMS Earth will experience three days of darkness!!!",
        "nasa confirms earth will experience three days of darkness",
        "NASA confirms Earth will experience\nthree days of darkness.",
      ];

      const hashes = await Promise.all(
        claims.map(async (claim) => {
          const normalized = normalizeClaim(claim);
          return await hashClaim(normalized.normalizedText);
        })
      );

      // All should produce the same hash
      expect(hashes[0]).toBe(hashes[1]);
      expect(hashes[1]).toBe(hashes[2]);
    });

    it("should produce different hashes for meaningfully different claims", async () => {
      const claims = [
        "NASA confirms Earth will experience three days of darkness",
        "NASA confirms Earth will experience five days of darkness",
        "ESA confirms Earth will experience three days of darkness",
        "NASA denies Earth will experience three days of darkness",
      ];

      const hashes = await Promise.all(
        claims.map(async (claim) => {
          const normalized = normalizeClaim(claim);
          return await hashClaim(normalized.normalizedText);
        })
      );

      // All should be different
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(claims.length);
    });

    it("should maintain hash consistency through idempotency", async () => {
      const original = "NASA CONFIRMS Earth!!!";
      const normalized = normalizeClaim(original);
      const identity = await createClaimIdentity(normalized);

      // Normalize the normalized text again
      const reNormalized = normalizeClaim(identity.normalizedText);
      const reIdentity = await createClaimIdentity(reNormalized);

      expect(identity.hash).toBe(reIdentity.hash);
      expect(identity.normalizedText).toBe(reIdentity.normalizedText);
    });
  });

  describe("Performance", () => {
    it("should hash quickly", async () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await hashClaim("test claim for performance measurement");
      }
      const duration = performance.now() - start;
      // 100 hashes should complete in reasonable time
      expect(duration).toBeLessThan(1000); // 1 second for 100 hashes
    });
  });
});