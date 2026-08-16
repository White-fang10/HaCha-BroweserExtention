/**
 * Health check controller.
 */
import { Response } from "express";
import { AuthenticatedRequest } from "../types/api.js";
import { logger } from "../utils/logger.js";

export function healthController(req: AuthenticatedRequest, res: Response): void {
  const requestId = req.context?.requestId || "unknown";

  logger.debug("Health check", { requestId });

  res.json({
    success: true,
    service: "hacha-backend",
    status: "healthy",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
  });
}