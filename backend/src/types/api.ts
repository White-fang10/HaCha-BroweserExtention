/**
 * API types and interfaces for the HaCha backend gateway.
 */
import express from "express";

/**
 * Source tier for verification responses.
 * Indicates which tier of the 3-tier cascade produced the result.
 */
export type SourceTier = "REDIS_CACHE" | "FACT_CHECK_API" | "AI_RAG";

/**
 * Verdict taxonomy - standardized across all services.
 * All verification responses MUST map to one of these 4 classifications.
 */
export type Verdict = "SUPPORTED" | "FALSE" | "MISLEADING" | "UNVERIFIED";

/**
 * Request to verify a claim.
 */
export interface VerifyRequest {
  claim: string;
}

/**
 * Source reference in verification response.
 */
export interface VerificationSource {
  title: string;
  url: string;
  publisher: string;
  publishDate: string;
  reliabilityScore?: number;
}

/**
 * Successful verification response data.
 */
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

/**
 * Success response wrapper.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Error response wrapper.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Union of success and error responses.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Specific response for verification endpoint.
 */
export type VerifyResponse = ApiResponse<VerificationData>;

/**
 * Health check response.
 */
export interface HealthResponse {
  success: true;
  service: string;
  status: string;
  environment: string;
  timestamp: string;
  version?: string;
}

/**
 * Error codes used across the API.
 */
export enum ApiErrorCode {
  INVALID_REQUEST = "INVALID_REQUEST",
  NOT_FOUND = "NOT_FOUND",
  METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  RATE_LIMITED = "RATE_LIMITED",
  UPSTREAM_ERROR = "UPSTREAM_ERROR",
  CACHE_ERROR = "CACHE_ERROR",
  AI_SERVICE_ERROR = "AI_SERVICE_ERROR",
}

/**
 * Request context attached by middleware.
 */
export interface RequestContext {
  requestId: string;
  startTime: number;
  ip?: string;
  userAgent?: string;
}

/**
 * Authenticated/contextual request type - Express Request with attached context.
 * Used by controllers to access request metadata.
 */
export type AuthenticatedRequest = express.Request & {
  context?: RequestContext;
};