/**
 * Verify Controller - handles POST /api/verify endpoint.
 * Validates request, calls verification service, returns structured response.
 */
import { Request, Response } from "express";
import { verifyClaim } from "../services/verification.service.js";
import { logger } from "../utils/logger.js";
import { VerifyRequest, VerifyResponse, ApiErrorCode } from "../types/api.js";

/**
 * Verify claim endpoint handler.
 * POST /api/verify
 * Body: { claim: string }
 */
export async function verifyController(req: Request, res: Response): Promise<void> {
  const requestId = req.context?.requestId || "unknown";
  const startTime = Date.now();

  try {
    // Extract and validate claim from request body
    const body = req.body as VerifyRequest;
    const claim = body?.claim;

    // Input validation
    if (!claim || typeof claim !== "string") {
      logger.warn("Invalid request: missing or invalid claim", { requestId });
      sendError(res, ApiErrorCode.INVALID_REQUEST, "Claim is required and must be a string", 400, requestId);
      return;
    }

    const trimmedClaim = claim.trim();
    if (trimmedClaim.length === 0) {
      logger.warn("Invalid request: empty claim", { requestId });
      sendError(res, ApiErrorCode.INVALID_REQUEST, "Claim cannot be empty", 400, requestId);
      return;
    }

    if (trimmedClaim.length > 5000) {
      logger.warn("Invalid request: claim too long", { requestId, claimLength: trimmedClaim.length });
      sendError(res, ApiErrorCode.INVALID_REQUEST, "Claim exceeds maximum length of 5000 characters", 400, requestId);
      return;
    }

    // Log incoming request (without sensitive content)
    logger.logRequest(requestId, req.method, req.path, trimmedClaim.length);

    // Call verification service
    const verificationData = await verifyClaim(trimmedClaim, requestId);

    // Build success response
    const response: VerifyResponse = {
      success: true,
      data: verificationData,
    };

    const durationMs = Date.now() - startTime;

    // Log response
    logger.logResponse(requestId, req.method, req.path, 200, durationMs);

    res.status(200).json(response);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error("Verify endpoint error", {
      requestId,
      error: error instanceof Error ? error.message : "Unknown error",
      durationMs,
    });

    // Error handler middleware will catch this, but we log here for context
    throw error;
  }
}

/**
 * Send a structured error response.
 */
function sendError(
  res: Response,
  code: ApiErrorCode,
  message: string,
  statusCode: number,
  requestId: string
): void {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };

  res.status(statusCode).json(response);
  logger.logResponse(requestId, "POST", "/api/verify", statusCode, Date.now());
}