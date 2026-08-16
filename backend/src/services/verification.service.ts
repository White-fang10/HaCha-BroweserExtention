/**
 * Verification Service - Stub Implementation
 *
 * This is a placeholder for the full 3-tier verification cascade:
 * 1. Redis Cache → 2. Google Fact Check API → 3. Python AI Service (RAG+LLM)
 *
 * Currently returns UNVERIFIED for all claims.
 * TODO: Implement the full verification cascade in Phase 5+.
 */
import { VerificationData, Verdict, SourceTier, VerificationSource } from "../types/api.js";
import { logger } from "../utils/logger.js";
import { createClaimId } from "../utils/claim-id.js";

/**
 * Generate SHA-256 hash of a claim for cache keys.
 */
async function hashClaim(claim: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(claim.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Normalize claim for consistent processing.
 */
function normalizeClaim(claim: string): string {
  return claim.trim().replace(/\s+/g, " ");
}

/**
 * Main verification function - stub implementation.
 * Returns UNVERIFIED for all claims until full cascade is implemented.
 */
export async function verifyClaim(claim: string, requestId: string): Promise<VerificationData> {
  const startTime = Date.now();
  const normalized = normalizeClaim(claim);
  const claimId = await createClaimId(normalized);
  const claimHash = await hashClaim(normalized);

  // Log without sensitive content
  logger.debug("Verifying claim", {
    requestId,
    claimHash,
    claimLength: normalized.length,
  });

  // TODO: Implement 3-tier cascade:
  // 1. Check Redis cache (Phase 5)
  // 2. Call Google Fact Check API (Phase 5)
  // 3. Call Python AI RAG service (Phase 6)

  // For now, return UNVERIFIED
  const result: VerificationData = {
    claimId,
    normalizedClaim: normalized,
    verdict: "UNVERIFIED" as Verdict,
    confidence: 0,
    explanation: "Verification service not yet implemented. This is a stub response.",
    sources: [],
    sourceTier: "AI_RAG" as SourceTier, // Will be determined by actual tier that responds
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
  return {
    redis: "not_configured",
    factCheckApi: "not_configured",
    aiService: "not_configured",
  };
}