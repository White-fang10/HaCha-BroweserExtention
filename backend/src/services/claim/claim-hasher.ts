/**
 * Claim Hasher - Phase 5
 *
 * Generates deterministic SHA-256 hash from normalized claim.
 * Isolated utility with no external dependencies.
 */

import { NORMALIZATION_VERSION, ClaimIdentity } from "../../types/claim.js";

/**
 * Create SHA-256 hash of normalized claim text.
 * Uses Web Crypto API (Node.js 16+).
 * @param normalizedClaim - Canonical normalized claim text
 * @returns 64-character hexadecimal SHA-256 digest
 */
export async function hashClaim(normalizedClaim: string): Promise<string> {
  const encoder = new TextEncoder();
  // Use UTF-8 encoding of normalized claim
  const data = encoder.encode(normalizedClaim);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create short hash for display (first 16 chars).
 */
export async function createShortHash(normalizedClaim: string): Promise<string> {
  const fullHash = await hashClaim(normalizedClaim);
  return fullHash.substring(0, 16);
}

/**
 * Verify if a string is a valid SHA-256 hex string.
 */
export function isValidHash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

/**
 * Create complete ClaimIdentity from normalized claim.
 * @param normalizedClaim - Result from normalizeClaim()
 * @returns Complete claim identity with hash and version
 */
export async function createClaimIdentity(
  normalizedClaim: { originalText: string; normalizedText: string; warnings: string[]; metadata: any }
): Promise<ClaimIdentity> {
  const hash = await hashClaim(normalizedClaim.normalizedText);
  return {
    originalText: normalizedClaim.originalText,
    normalizedText: normalizedClaim.normalizedText,
    hash,
    normalizationVersion: NORMALIZATION_VERSION,
    warnings: normalizedClaim.warnings,
    metadata: normalizedClaim.metadata,
  };
}

/**
 * Create cache key for Redis (Phase 6).
 * Format: hacha:claim:v1:<sha256>
 */
export function createCacheKey(hash: string): string {
  return `hacha:claim:${NORMALIZATION_VERSION}:${hash}`;
}

/**
 * Parse cache key to extract version and hash.
 */
export function parseCacheKey(key: string): { version: string; hash: string } | null {
  const match = key.match(/^hacha:claim:([^:]+):([a-f0-9]{64})$/);
  if (!match) return null;
  return { version: match[1], hash: match[2] };
}