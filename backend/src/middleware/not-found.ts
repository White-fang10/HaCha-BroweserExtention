/**
 * 404 Not Found handler.
 * Returns structured JSON error for unknown routes.
 */
import { Request, Response } from "express";
import { createNotFoundError } from "./error-handler.js";

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = req.context?.requestId || "unknown";

  const error = createNotFoundError(`Route ${req.method} ${req.path} not found`);

  // Use the error handler logic
  res.status(404).json({
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  });
}