/**
 * Zod validation schemas for API requests.
 */
import { z } from "zod";
import { env } from "../config/env.js";

/**
 * Schema for the verify claim request.
 * Enforces: claim exists, is string, not empty/whitespace, within max length.
 */
export const verifyRequestSchema = z.object({
  claim: z
    .string()
    .min(1, "Claim must not be empty")
    .max(env.maxClaimLength, `Claim must not exceed ${env.maxClaimLength} characters`)
    .refine((val) => val.trim().length > 0, "Claim must not be whitespace only"),
});

/**
 * Type inferred from the schema for TypeScript type safety.
 */
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

/**
 * Schema for health check query params (if any future params needed).
 */
export const healthQuerySchema = z.object({});

/**
 * Validate a request body against the verify schema.
 * Returns parsed data or throws ZodError.
 */
export function validateVerifyRequest(body: unknown): VerifyRequest {
  return verifyRequestSchema.parse(body);
}