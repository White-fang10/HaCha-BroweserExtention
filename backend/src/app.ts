/**
 * Express Application Assembly.
 * Configures middleware, routes, and error handling in the correct order.
 */
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { logger } from "./utils/logger.js";
import { verifyRoutes } from "./routes/verify.routes.js";
import { healthRoutes } from "./routes/health.routes.js";

/**
 * Create and configure the Express application.
 */
export function createApp(): express.Application {
  const app = express();

  // 1. Request ID middleware (first - attaches context to all requests)
  app.use(requestIdMiddleware);

  // 2. Request logging middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    const requestId = req.context?.requestId || "unknown";

    // Log incoming request
    logger.logRequest(requestId, req.method, req.path);

    // Log response when finished
    res.on("finish", () => {
      const durationMs = Date.now() - startTime;
      logger.logResponse(requestId, req.method, req.path, res.statusCode, durationMs);
    });

    next();
  });

  // 3. CORS configuration
  const corsOptions: cors.CorsOptions = {
    origin: env.corsOrigin,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
    credentials: false,
    maxAge: 86400, // 24 hours
  };
  app.use(cors(corsOptions));

  // 4. JSON body parser with size limit
  app.use(express.json({ limit: "1mb" }));

  // 5. URL encoded parser (for form data if needed)
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));

  // 6. API routes
  app.use("/api/verify", verifyRoutes);
  app.use("/api/health", healthRoutes);

  // 7. 404 handler for unknown routes (must be after all routes)
  app.use(notFoundHandler);

  // 8. Error handler (must be last)
  app.use(errorHandler);

  return app;
}