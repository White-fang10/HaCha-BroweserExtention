/**
 * Authentication Middleware - Phase 12
 * Implements token-based authentication for Extension→Gateway and Gateway→AI Service boundaries.
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * Token payload for extension authentication.
 */
export interface ExtensionTokenPayload {
  /** Extension identifier (e.g., "hacha-extension") */
  extensionId: string;
  /** Version of the extension */
  version: string;
  /** Timestamp when token was issued */
  issuedAt: number;
  /** Optional: session identifier */
  sessionId?: string;
}

/**
 * Token payload for AI service authentication.
 */
export interface AIServiceTokenPayload {
  /** Service identifier (e.g., "hacha-gateway") */
  serviceId: string;
  /** Timestamp when token was issued */
  issuedAt: number;
  /** Request ID for correlation */
  requestId: string;
}

/**
 * Authenticated request context.
 */
export interface AuthContext {
  /** Authenticated extension or service ID */
  identity: string;
  /** Type of authentication */
  type: "extension" | "ai-service";
  /** Token metadata */
  tokenData: ExtensionTokenPayload | AIServiceTokenPayload;
}

/**
 * Extend Express Request with auth context.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Validate extension token format and signature.
 * In production, this would verify a JWT or HMAC signature.
 * For now, we validate the structure and check against configured secrets.
 */
function validateExtensionToken(token: string): ExtensionTokenPayload | null {
  try {
    // Expected format: "hacha_v1_<base64(payload)>_<signature>"
    const parts = token.split("_");
    if (parts.length !== 4 || parts[0] !== "hacha" || parts[1] !== "v1") {
      return null;
    }

    const payloadB64 = parts[2];
    const signature = parts[3];

    // Decode payload
    const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
    const payload: ExtensionTokenPayload = JSON.parse(payloadJson);

    // Validate required fields
    if (!payload.extensionId || !payload.version || !payload.issuedAt) {
      return null;
    }

    // Verify extension ID
    if (payload.extensionId !== "hacha-extension") {
      return null;
    }

    // Check token age (max 24 hours)
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - payload.issuedAt > maxAge) {
      return null;
    }

    // Verify signature (in production, use proper HMAC)
    const expectedSignature = generateSignature(payloadB64, env.extensionAuthSecret);
    if (signature !== expectedSignature) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Validate AI service token.
 */
function validateAIServiceToken(token: string, requestId: string): AIServiceTokenPayload | null {
  try {
    // Expected format: "hacha-ai_v1_<base64(payload)>_<signature>"
    const parts = token.split("_");
    if (parts.length !== 4 || parts[0] !== "hacha-ai" || parts[1] !== "v1") {
      return null;
    }

    const payloadB64 = parts[2];
    const signature = parts[3];

    // Decode payload
    const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
    const payload: AIServiceTokenPayload = JSON.parse(payloadJson);

    // Validate required fields
    if (!payload.serviceId || !payload.issuedAt || !payload.requestId) {
      return null;
    }

    // Verify service ID
    if (payload.serviceId !== "hacha-gateway") {
      return null;
    }

    // Check token age (max 5 minutes for AI service calls)
    const maxAge = 5 * 60 * 1000;
    if (Date.now() - payload.issuedAt > maxAge) {
      return null;
    }

    // Verify request ID matches
    if (payload.requestId !== requestId) {
      return null;
    }

    // Verify signature
    const expectedSignature = generateSignature(payloadB64, env.aiServiceAuthSecret);
    if (signature !== expectedSignature) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generate HMAC signature for token.
 */
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex").substring(0, 32);
}

/**
 * Middleware to authenticate Extension → Gateway requests.
 * Expects Authorization: Bearer <token> header.
 */
export function extensionAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.context?.requestId || "unknown";

  // Get Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    logger.warn("Missing Authorization header", { requestId });
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing Authorization header",
      },
    });
    return;
  }

  // Parse Bearer token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    logger.warn("Invalid Authorization header format", { requestId });
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid Authorization header format",
      },
    });
    return;
  }

  const token = parts[1];

  // Validate token
  const payload = validateExtensionToken(token);
  if (!payload) {
    logger.warn("Invalid or expired extension token", { requestId });
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired authentication token",
      },
    });
    return;
  }

  // Attach auth context to request
  req.auth = {
    identity: payload.extensionId,
    type: "extension",
    tokenData: payload,
  };

  logger.debug("Extension authenticated", { requestId, extensionId: payload.extensionId, sessionId: payload.sessionId });
  next();
}

/**
 * Middleware to authenticate Gateway → AI Service requests.
 * Expects X-AI-Service-Token header with request ID correlation.
 */
export function aiServiceAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.context?.requestId || "unknown";

  // Get AI service token header
  const token = req.headers["x-ai-service-token"] as string;
  if (!token) {
    logger.warn("Missing AI service token", { requestId });
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing AI service authentication token",
      },
    });
    return;
  }

  // Validate token
  const payload = validateAIServiceToken(token, requestId);
  if (!payload) {
    logger.warn("Invalid or expired AI service token", { requestId });
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired AI service authentication token",
      },
    });
    return;
  }

  // Attach auth context to request
  req.auth = {
    identity: payload.serviceId,
    type: "ai-service",
    tokenData: payload,
  };

  logger.debug("AI service authenticated", { requestId, serviceId: payload.serviceId });
  next();
}

/**
 * Optional authentication middleware - allows unauthenticated requests but adds auth context if present.
 */
export function optionalExtensionAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.context?.requestId || "unknown";

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return next();
  }

  const token = parts[1];
  const payload = validateExtensionToken(token);
  if (payload) {
    req.auth = {
      identity: payload.extensionId,
      type: "extension",
      tokenData: payload,
    };
  }

  next();
}

/**
 * Generate extension authentication token.
 * Used by the extension to create valid tokens.
 */
export function generateExtensionToken(
  extensionId: string = "hacha-extension",
  version: string,
  sessionId?: string
): string {
  const payload: ExtensionTokenPayload = {
    extensionId,
    version,
    issuedAt: Date.now(),
    sessionId,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = generateSignature(payloadB64, env.extensionAuthSecret);

  return `hacha_v1_${payloadB64}_${signature}`;
}

/**
 * Generate AI service authentication token.
 * Used by the gateway when calling the AI service.
 */
export function generateAIServiceToken(requestId: string): string {
  const payload: AIServiceTokenPayload = {
    serviceId: "hacha-gateway",
    issuedAt: Date.now(),
    requestId,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  const signature = generateSignature(payloadB64, env.aiServiceAuthSecret);

  return `hacha-ai_v1_${payloadB64}_${signature}`;
}

/**
 * Verify an extension token without middleware (for testing/internal use).
 */
export function verifyExtensionToken(token: string): ExtensionTokenPayload | null {
  return validateExtensionToken(token);
}

/**
 * Verify an AI service token without middleware (for testing/internal use).
 */
export function verifyAIServiceToken(token: string, requestId: string): AIServiceTokenPayload | null {
  return validateAIServiceToken(token, requestId);
}

export {};