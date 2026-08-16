/**
 * Verify Routes - POST /api/verify endpoint with Zod validation.
 */
import express, { Router } from "express";
import { z } from "zod";
import { verifyController } from "../controllers/verify.controller.js";
import { logger } from "../utils/logger.js";

const router: Router = Router();

/**
 * Zod schema for verify request validation.
 * Applied via middleware before controller.
 */
const verifyRequestSchema = z.object({
  body: z.object({
    claim: z
      .string()
      .min(1, "Claim cannot be empty")
      .max(5000, "Claim exceeds maximum length of 5000 characters")
      .trim(),
  }),
});

/**
 * Validation middleware factory for Zod schemas.
 */
function validate(schema: z.ZodSchema) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const requestId = req.context?.requestId || "unknown";
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const messages = result.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");

      logger.warn("Validation failed", { requestId, errors: messages });
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: messages,
          details: result.error.errors,
        },
      });
      return;
    }

    // Attach validated data
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;

    next();
  };
}

/**
 * POST /api/verify
 * Verify a claim through the 3-tier cascade.
 * Body: { claim: string }
 */
router.post("/", validate(verifyRequestSchema), verifyController);

export { router as verifyRoutes };