/**
 * Request ID middleware.
 * Generates or propagates a unique request ID for tracing.
 */
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { RequestContext } from "../types/api.js";
import { logger } from "../utils/logger.js";

// Extend Express Request type to include context
declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get request ID from header or generate new one
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();

  // Attach context to request
  req.context = {
    requestId,
    startTime: Date.now(),
    ip: req.ip,
    userAgent: req.get("user-agent"),
  };

  // Set response header for client correlation
  res.setHeader("X-Request-ID", requestId);

  next();
}