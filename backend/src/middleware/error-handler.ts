/**
 * Centralized error handling middleware.
 * All route errors flow through here for consistent JSON responses.
 */
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../utils/logger.js";
import { ApiErrorCode, ApiErrorResponse } from "../types/api.js";

/**
 * Custom error class for API errors with structured codes.
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Error handler middleware.
 * Must be registered AFTER all routes.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.context?.requestId || "unknown";

  // Log the error
  logger.error("Request error", {
    requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    sendErrorResponse(res, ApiErrorCode.INVALID_REQUEST, messages, 400, requestId);
    return;
  }

  // Handle our custom API errors
  if (err instanceof ApiError) {
    sendErrorResponse(res, err.code, err.message, err.statusCode, requestId, err.details);
    return;
  }

  // Handle Express body parser errors (e.g., JSON too large)
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    sendErrorResponse(res, ApiErrorCode.INVALID_REQUEST, "Invalid JSON payload", 400, requestId);
    return;
  }

  // Handle body size limit errors
  if (err instanceof Error && err.message === "request entity too large") {
    sendErrorResponse(res, ApiErrorCode.INVALID_REQUEST, "Request body too large", 413, requestId);
    return;
  }

  // Unknown/internal error - don't expose internal details
  sendErrorResponse(res, ApiErrorCode.INTERNAL_ERROR, "An internal error occurred", 500, requestId);
}

/**
 * Send a structured error response.
 */
function sendErrorResponse(
  res: Response,
  code: ApiErrorCode,
  message: string,
  statusCode: number,
  requestId: string,
  details?: unknown
): void {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Create a not found error.
 */
export function createNotFoundError(message: string = "Route not found"): ApiError {
  return new ApiError(ApiErrorCode.NOT_FOUND, message, 404);
}

/**
 * Create an invalid request error.
 */
export function createInvalidRequestError(message: string, details?: unknown): ApiError {
  return new ApiError(ApiErrorCode.INVALID_REQUEST, message, 400, details);
}

/**
 * Create an internal error.
 */
export function createInternalError(message: string = "An internal error occurred"): ApiError {
  return new ApiError(ApiErrorCode.INTERNAL_ERROR, message, 500);
}

/**
 * Create a service unavailable error.
 */
export function createServiceUnavailableError(message: string = "Service temporarily unavailable"): ApiError {
  return new ApiError(ApiErrorCode.SERVICE_UNAVAILABLE, message, 503);
}

/**
 * Create a rate limited error.
 */
export function createRateLimitedError(message: string = "Too many requests"): ApiError {
  return new ApiError(ApiErrorCode.RATE_LIMITED, message, 429);
}