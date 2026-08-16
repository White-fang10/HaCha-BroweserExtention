/**
 * Health Routes - GET /api/health endpoint.
 */
import { Router } from "express";
import { healthController } from "../controllers/health.controller.js";

const router = Router();

/**
 * GET /api/health
 * Health check endpoint for load balancers and monitoring.
 */
router.get("/", healthController);

export { router as healthRoutes };