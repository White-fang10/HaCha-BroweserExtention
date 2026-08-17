/**
 * Rate Limiting Middleware - Phase 12
 * Implements sliding window rate limiting using Redis.
 */
import { Request, Response, NextFunction } from "express";
import { getRedisClient } from "../services/cache/redis.client.js";
import { logger } from "../utils/logger.js";
import { createRateLimitedError, ApiErrorCode } from "./error-handler.js";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyPrefix: "rate:ip",
};

/**
 * Create rate limiting middleware with sliding window algorithm.
 * Uses Redis sorted sets for accurate sliding window.
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const config: RateLimitConfig = {
    ...DEFAULT_CONFIG,
    ...options,
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const redis = getRedisClient();
    if (!redis) {
      logger.warn("Redis not available, skipping rate limit");
      return next();
    }

    const requestId = req.context?.requestId || "unknown";
    const key = config.keyGenerator
      ? config.keyGenerator(req)
      : `${config.keyPrefix}:${req.ip || "unknown"}`;

    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      const multi = redis.multi();

      // Remove expired entries
      multi.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      multi.zcard(key);

      // Add current request
      multi.zadd(key, now, `${now}:${Math.random()}`);

      // Set TTL on the key
      multi.expire(key, Math.ceil(config.windowMs / 1000) + 1);

      const results = await multi.exec();

      if (!results) {
        logger.warn("Rate limiter Redis multi exec returned null", { requestId, key });
        return next();
      }

      const currentCount = results[1][1] as number;

      // Set rate limit headers
      const remaining = Math.max(0, config.maxRequests - currentCount);
      res.setHeader("X-RateLimit-Limit", config.maxRequests.toString());
      res.setHeader("X-RateLimit-Remaining", remaining.toString());
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + config.windowMs) / 1000).toString());

      if (currentCount > config.maxRequests) {
        logger.warn("Rate limit exceeded", {
          requestId,
          key,
          count: currentCount,
          limit: config.maxRequests,
          ip: req.ip,
        });

        const error = createRateLimitedError(
          `Rate limit exceeded. Try again in ${Math.ceil(config.windowMs / 1000)} seconds.`
        );

        res.setHeader("Retry-After", Math.ceil(config.windowMs / 1000).toString());
        res.status(429).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      next();
    } catch (error) {
      logger.error("Rate limiter error", { requestId, error: (error as Error).message });
      // Fail open - don't block requests if rate limiter fails
      next();
    }
  };
}

/**
 * Pre-configured rate limiters for different endpoints.
 */
export const rateLimiters = {
  // Strict rate limiting for verify endpoint
  verify: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyPrefix: "rate:verify",
  }),

  // Per-IP rate limiting for health endpoints (more lenient)
  health: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyPrefix: "rate:health",
  }),

  // Per-session rate limiting for activation
  activation: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    keyPrefix: "rate:activation",
    keyGenerator: (req) => {
      const sessionId = req.headers["x-session-id"] as string || req.ip || "unknown";
      return `rate:activation:${sessionId}`;
    },
  }),
};

/**
 * Composite rate limiter - applies multiple limiters.
 */
export function compositeRateLimiter(...limiters: Array<(req: Request, res: Response, next: NextFunction) => Promise<void>>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    for (const limiter of limiters) {
      await new Promise<void>((resolve, reject) => {
        limiter(req, res, (err) => {
          if (err) return reject(err);
          if (res.headersSent) return reject(new Error("Rate limited"));
          resolve();
        });
      });

      if (res.headersSent) return;
    }
    next();
  };
}