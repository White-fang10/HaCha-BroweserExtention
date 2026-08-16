/**
 * Cache Key Generator - Phase 6
 *
 * Generates and parses structured Redis cache keys.
 * Format: hacha:claim:v1:<sha256>
 */

import { CACHE_SCHEMA_VERSION } from "../../types/cache.js";

/** Cache key components */
export interface CacheKeyParts {
  /** Application namespace (always "hacha") */
  namespace: string;
  /** Data type (always "claim") */
  dataType: string;
  /** Cache schema version */
  version: string;
  /** SHA-256 hash of normalized claim */
  hash: string;
}

/**
 * Create a cache key from a claim hash.
 * @param claimHash - SHA-256 hash of normalized claim (64 hex chars)
 * @param version - Cache schema version (default: CACHE_SCHEMA_VERSION)
 * @returns Full cache key
 */
export function createCacheKey(claimHash: string, version: string = CACHE_SCHEMA_VERSION): string {
  return `hacha:claim:${version}:${claimHash}`;
}

/**
 * Parse a cache key into its components.
 * @param key - Full cache key
 * @returns Parsed components or null if invalid format
 */
export function parseCacheKey(key: string): CacheKeyParts | null {
  const parts = key.split(":");
  if (parts.length !== 4) {
    return null;
  }

  const [namespace, dataType, version, hash] = parts;

  if (namespace !== "hacha" || dataType !== "claim" || hash.length !== 64) {
    return null;
  }

  // Validate hex
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return null;
  }

  return {
    namespace,
    dataType,
    version,
    hash,
  };
}

/**
 * Validate a cache key format.
 * @param key - Cache key to validate
 * @returns True if valid format
 */
export function isValidCacheKey(key: string): boolean {
  return parseCacheKey(key) !== null;
}

/**
 * Extract claim hash from cache key.
 * @param key - Full cache key
 * @returns Claim hash or null if invalid
 */
export function extractClaimHash(key: string): string | null {
  const parsed = parseCacheKey(key);
  return parsed?.hash ?? null;
}

/**
 * Extract version from cache key.
 * @param key - Full cache key
 * @returns Version or null if invalid
 */
export function extractVersion(key: string): string | null {
  const parsed = parseCacheKey(key);
  return parsed?.version ?? null;
}