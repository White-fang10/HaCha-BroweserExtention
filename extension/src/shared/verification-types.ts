/**
 * Verification types matching the HaCha backend API.
 * Used by the extension to communicate with the backend gateway.
 */

export type Verdict = "SUPPORTED" | "FALSE" | "MISLEADING" | "UNVERIFIED";

export type SourceTier = "REDIS_CACHE" | "FACT_CHECK_API" | "AI_RAG";

export interface VerificationSource {
    title: string;
    url: string;
    publisher: string;
    publishDate: string;
    reliabilityScore?: number;
}

export interface VerificationData {
    claimId: string;
    normalizedClaim: string;
    verdict: Verdict;
    confidence: number;
    explanation: string;
    sources: VerificationSource[];
    sourceTier: SourceTier;
    cached: boolean;
    timestamp: string;
}

export interface VerifySuccessResponse {
    success: true;
    data: VerificationData;
}

export interface VerifyErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export type VerifyResponse = VerifySuccessResponse | VerifyErrorResponse;

/**
 * Backend endpoint configuration.
 */
export const BACKEND_CONFIG = {
    BASE_URL: "http://localhost:3000",
    VERIFY_ENDPOINT: "/api/verify",
    HEALTH_ENDPOINT: "/api/health",
    TIMEOUT_MS: 15000,
} as const;
