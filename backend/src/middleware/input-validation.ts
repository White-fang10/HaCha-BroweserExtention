/**
 * Input Validation Middleware - Phase 12
 * Comprehensive request validation including:
 * - Size limits
 * - Character set validation
 * - Control character detection
 * - Potential prompt injection patterns
 * - Unicode/encoding attacks
 */

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { logger } from "../utils/logger.js";

/**
 * Configuration for input validation.
 */
export interface InputValidationConfig {
  maxBodySize: number;
  allowedContentTypes: string[];
  checkControlChars: boolean;
  checkInjectionPatterns: boolean;
  maxFieldLength: number;
  rejectNullBytes: boolean;
}

/**
 * Default validation configuration.
 */
const DEFAULT_CONFIG: InputValidationConfig = {
  maxBodySize: 1024 * 1024, // 1MB
  allowedContentTypes: ["application/json"],
  checkControlChars: true,
  checkInjectionPatterns: true,
  maxFieldLength: 5000,
  rejectNullBytes: true,
};

/**
 * Patterns that may indicate prompt injection attempts.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts?)/i,
  /disregard\s+(your|the)\s+(instructions|system\s+prompt)/i,
  /system\s*:\s*you\s+are\s+now/i,
  /\[system\]\s*ignore/i,
  /<\|im_start\|>/,
  /<\|im_end\|>/,
  /new\s+instructions?\s*:/i,
  /override\s+(your|the)\s+(safety|guidelines|instructions)/i,
  /you\s+must\s+(now\s+)?(reveal|tell|provide|execute)/i,
  /pretending\s+to\s+be\s+an?\s+(ai|assistant|system)/i,
];

/**
 * Validate request body size.
 */
function validateBodySize(req: Request, config: InputValidationConfig, requestId: string): string | null {
  const contentLength = req.headers["content-length"];
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > config.maxBodySize) {
      logger.warn("Request body too large", { requestId, size, maxSize: config.maxBodySize });
      return `Request body exceeds maximum size of ${config.maxBodySize} bytes`;
    }
  }
  return null;
}

/**
 * Validate content type.
 */
function validateContentType(req: Request, config: InputValidationConfig, requestId: string): string | null {
  const contentType = req.headers["content-type"];
  if (!contentType) {
    return null; // Let other middleware handle missing content-type
  }

  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  if (!config.allowedContentTypes.includes(mediaType)) {
    logger.warn("Unsupported content type", { requestId, contentType: mediaType });
    return `Unsupported content type: ${mediaType}. Allowed: ${config.allowedContentTypes.join(", ")}`;
  }
  return null;
}

/**
 * Check for control characters in string.
 */
function checkControlChars(str: string): boolean {
  // Check for control characters (except tab, newline, carriage return)
  return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(str);
}

/**
 * Check for null bytes in string.
 */
function checkNullBytes(str: string): boolean {
  return str.includes("\0");
}

/**
 * Check for potential injection patterns.
 */
function checkInjectionPatterns(str: string): string | null {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(str)) {
      return `Potential injection pattern detected: ${pattern.source}`;
    }
  }
  return null;
}

/**
 * Check for overly long strings (potential DoS).
 */
function checkFieldLength(str: string, maxLength: number): string | null {
  if (str.length > maxLength) {
    return `Field exceeds maximum length of ${maxLength} characters`;
  }
  return null;
}

/**
 * Recursively validate object fields.
 */
function validateFields(obj: unknown, config: InputValidationConfig, requestId: string, path: string): string | null {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj === "string") {
    if (config.rejectNullBytes && checkNullBytes(obj)) {
      logger.warn("Null byte detected in input", { requestId, path });
      return `${path}: null bytes are not allowed`;
    }

    if (config.checkControlChars && checkControlChars(obj)) {
      logger.warn("Control characters detected in input", { requestId, path });
      return `${path}: control characters are not allowed`;
    }

    if (config.checkInjectionPatterns) {
      const injectionError = checkInjectionPatterns(obj);
      if (injectionError) {
        logger.warn("Potential injection pattern detected", { requestId, path, pattern: injectionError });
        return `${path}: ${injectionError}`;
      }
    }

    const lengthError = checkFieldLength(obj, config.maxFieldLength);
    if (lengthError) {
      return `${path}: ${lengthError}`;
    }

    return null;
  }

  if (Array.isArray(obj)) {
    if (obj.length > 100) {
      return `${path}: array exceeds maximum of 100 items`;
    }
    for (let i = 0; i < obj.length; i++) {
      const result = validateFields(obj[i], config, requestId, `${path}[${i}]`);
      if (result) return result;
    }
    return null;
  }

  if (typeof obj === "object") {
    const keys = Object.keys(obj);
    if (keys.length > 50) {
      return `${path}: object exceeds maximum of 50 fields`;
    }
    for (const key of keys) {
      const result = validateFields((obj as Record<string, unknown>)[key], config, requestId, `${path}.${key}`);
      if (result) return result;
    }
    return null;
  }

  return null;
}

/**
 * Create input validation middleware.
 */
export function createInputValidationMiddleware(config: Partial<InputValidationConfig> = {}) {
  const mergedConfig: InputValidationConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.context?.requestId || "unknown";

    // Validate body size
    const sizeError = validateBodySize(req, mergedConfig, requestId);
    if (sizeError) {
      res.status(413).json({
        success: false,
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: sizeError,
        },
      });
      return;
    }

    // Validate content type
    const contentTypeError = validateContentType(req, mergedConfig, requestId);
    if (contentTypeError) {
      res.status(415).json({
        success: false,
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: contentTypeError,
        },
      });
      return;
    }

    // Validate body fields (only for JSON requests)
    if (req.body && typeof req.body === "object") {
      const fieldError = validateFields(req.body, mergedConfig, requestId, "body");
      if (fieldError) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: fieldError,
          },
        });
        return;
      }
    }

    // Validate query parameters
    if (req.query && typeof req.query === "object") {
      const queryError = validateFields(req.query, mergedConfig, requestId, "query");
      if (queryError) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_QUERY",
            message: queryError,
          },
        });
        return;
      }
    }

    next();
  };
}

/**
 * Pre-configured validation middleware for different endpoints.
 */
export const inputValidation = {
  // Strict validation for verify endpoint
  verify: createInputValidationMiddleware({
    maxBodySize: 1024 * 1024, // 1MB
    maxFieldLength: 5000,
    checkControlChars: true,
    checkInjectionPatterns: true,
    rejectNullBytes: true,
  }),

  // Lenient validation for health endpoint
  health: createInputValidationMiddleware({
    maxBodySize: 1024, // 1KB (should be empty for GET)
    maxFieldLength: 100,
    checkControlChars: true,
    checkInjectionPatterns: false,
    rejectNullBytes: true,
  }),

  // No validation (for internal endpoints if needed)
  none: createInputValidationMiddleware({
    checkControlChars: false,
    checkInjectionPatterns: false,
    rejectNullBytes: false,
  }),
};

export {};