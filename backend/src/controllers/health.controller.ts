/**
 * Health check controller.
 */
import { Response } from "express";
import { AuthenticatedRequest } from "../types/api.js";
import { logger } from "../utils/logger.js";
import { checkVerificationHealth } from "../services/verification.service.js";

export async function healthController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const requestId = req.context?.requestId || "unknown";

  logger.debug("Health check", { requestId });

  const dependencies = await checkVerificationHealth();

  // Overall status: healthy if at least one verification tier is available
  const overallStatus = dependencies.redis === "healthy" ? "healthy" : "degraded";

  res.json({
    success: true,
    service: "hacha-backend",
    status: overallStatus,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    dependencies,
  });
}