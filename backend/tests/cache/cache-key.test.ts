/**
 * Cache Key Tests - Phase 6
 * Tests for cache key generation and parsing.
 */

import { describe, it, expect } from "vitest";
import { createCacheKey, parseCacheKey, isValidCacheKey, extractClaimHash, extractVersion } from "../../src/services/cache/cache-key.js";
import { CACHE_SCHEMA_VERSION } from "../../src/types/cache.js";

describe("Cache Key Generation", () => {
  const testHash = "a".repeat(64);

  describe("createCacheKey", () => {
    it("should create proper cache key format with default version", () => {
      const key = createCacheKey(testHash);
      expect(key).toBe(`hacha:claim:${CACHE_SCHEMA_VERSION}:${testHash}`);
    });

    it("should create proper cache key format with custom version", () => {
      const key = createCacheKey(testHash, "v2");
      expect(key).toBe("hacha:claim:v2:" + testHash);
    });

    it("should produce consistent keys for same input", () => {
      const key1 = createCacheKey(testHash);
      const key2 = createCacheKey(testHash);
      expect(key1).toBe(key2);
    });

    it("should produce different keys for different hashes", () => {
      const key1 = createCacheKey("a".repeat(64));
      const key2 = createCacheKey("b".repeat(64));
      expect(key1).not.toBe(key2);
    });
  });

  describe("parseCacheKey", () => {
    it("should parse valid cache key correctly", () => {
      const key = createCacheKey(testHash);
      const parsed = parseCacheKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed!.namespace).toBe("hacha");
      expect(parsed!.dataType).toBe("claim");
      expect(parsed!.version).toBe(CACHE_SCHEMA_VERSION);
      expect(parsed!.hash).toBe(testHash);
    });

    it("should parse cache key with custom version", () => {
      const key = createCacheKey(testHash, "v2");
      const parsed = parseCacheKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed!.version).toBe("v2");
    });

    it("should return null for invalid format (wrong parts count)", () => {
      expect(parseCacheKey("invalid:key")).toBeNull();
      expect(parseCacheKey("hacha:claim:v1")).toBeNull();
      expect(parseCacheKey("hacha:claim:v1:hash:extra")).toBeNull();
    });

    it("should return null for wrong namespace", () => {
      const key = "other:claim:v1:" + testHash;
      expect(parseCacheKey(key)).toBeNull();
    });

    it("should return null for wrong data type", () => {
      const key = "hacha:other:v1:" + testHash;
      expect(parseCacheKey(key)).toBeNull();
    });

    it("should return null for invalid hash length", () => {
      const key = "hacha:claim:v1:" + "a".repeat(63);
      expect(parseCacheKey(key)).toBeNull();

      const key2 = "hacha:claim:v1:" + "a".repeat(65);
      expect(parseCacheKey(key2)).toBeNull();
    });

    it("should return null for non-hex hash", () => {
      const key = "hacha:claim:v1:" + "g".repeat(64);
      expect(parseCacheKey(key)).toBeNull();
    });
  });

  describe("isValidCacheKey", () => {
    it("should return true for valid cache key", () => {
      const key = createCacheKey(testHash);
      expect(isValidCacheKey(key)).toBe(true);
    });

    it("should return false for invalid cache keys", () => {
      expect(isValidCacheKey("invalid")).toBe(false);
      expect(isValidCacheKey("hacha:claim:v1:short")).toBe(false);
      expect(isValidCacheKey("other:claim:v1:" + testHash)).toBe(false);
    });
  });

  describe("extractClaimHash", () => {
    it("should extract hash from valid key", () => {
      const key = createCacheKey(testHash);
      expect(extractClaimHash(key)).toBe(testHash);
    });

    it("should return null for invalid key", () => {
      expect(extractClaimHash("invalid")).toBeNull();
    });
  });

  describe("extractVersion", () => {
    it("should extract version from valid key", () => {
      const key = createCacheKey(testHash);
      expect(extractVersion(key)).toBe(CACHE_SCHEMA_VERSION);
    });

    it("should return null for invalid key", () => {
      expect(extractVersion("invalid")).toBeNull();
    });
  });
});