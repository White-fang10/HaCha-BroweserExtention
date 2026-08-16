/**
 * Claim ID utility - generates SHA-256 hash for claim deduplication and cache keys.
 */

/**
 * Create a SHA-256 hash of a normalized claim for use as claimId and cache key.
 * Uses Web Crypto API (available in Node.js 16+).
 */
export async function createClaimId(claim: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(claim.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a short claim ID (first 16 chars) for display purposes.
 */
export async function createShortClaimId(claim: string): Promise<string> {
  const fullId = await createClaimId(claim);
  return fullId.substring(0, 16);
}

/**
 * Verify if a string is a valid SHA-256 hex string.
 */
export function isValidClaimId(id: string): boolean {
  return /^[a-f0-9]{64}$/.test(id);
}