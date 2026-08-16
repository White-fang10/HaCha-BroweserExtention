/**
 * Redis Client - Phase 6
 *
 * Manages the Redis connection lifecycle with proper connection reuse,
 * health checks, and graceful shutdown.
 */

import Redis from "ioredis";
import { CacheConfig } from "../../types/cache.js";
import { logger } from "../../utils/logger.js";

/** Redis client instance */
let redisClient: Redis | null = null;

/** Connection state */
let isConnected = false;
let isConnecting = false;

/**
 * Create and configure Redis client.
 * @param config - Cache configuration
 * @returns Configured Redis client
 */
export function createRedisClient(config: CacheConfig): Redis {
  if (redisClient) {
    return redisClient;
  }

  const client = new Redis(config.redisUrl, {
    maxRetriesPerRequest: config.maxRetries,
    retryStrategy: (times) => {
      if (times > config.maxRetries) {
        logger.warn("Redis max retries reached, stopping retry", { times });
        return null;
      }
      const delay = Math.min(times * 200, 5000);
      logger.debug("Redis retry attempt", { times, delay });
      return delay;
    },
    connectTimeout: config.connectTimeoutMs,
    commandTimeout: config.commandTimeoutMs,
    lazyConnect: true,
    enableReadyCheck: true,
  });

  client.on("connect", () => {
    isConnected = true;
    isConnecting = false;
    logger.info("Redis connected");
  });

  client.on("ready", () => {
    isConnected = true;
    logger.debug("Redis ready");
  });

  client.on("error", (error) => {
    logger.error("Redis error", { error: error.message });
    isConnected = false;
  });

  client.on("close", () => {
    isConnected = false;
    logger.warn("Redis connection closed");
  });

  client.on("reconnecting", () => {
    isConnecting = true;
    logger.debug("Redis reconnecting");
  });

  redisClient = client;
  return client;
}

/**
 * Connect to Redis.
 * @param config - Cache configuration
 * @returns Connected Redis client
 */
export async function connectRedis(config: CacheConfig): Promise<Redis> {
  if (isConnected && redisClient) {
    return redisClient;
  }

  if (isConnecting && redisClient) {
    // Wait for existing connection attempt
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Connection timeout")), 10000);
      const checkConnection = setInterval(() => {
        if (isConnected || !isConnecting) {
          clearInterval(checkConnection);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
    return redisClient!;
  }

  const client = createRedisClient(config);
  isConnecting = true;

  try {
    await client.connect();
    isConnected = true;
    isConnecting = false;
    logger.info("Redis connection established");
    return client;
  } catch (error) {
    isConnecting = false;
    isConnected = false;
    logger.error("Redis connection failed", { error: (error as Error).message });
    throw error;
  }
}

/**
 * Get the Redis client instance.
 * @returns Redis client or null if not initialized
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Check if Redis is connected.
 * @returns True if connected and ready
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null && redisClient.status === "ready";
}

/**
 * Close Redis connection gracefully.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    logger.info("Closing Redis connection");
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    isConnecting = false;
    logger.info("Redis connection closed");
  }
}

/**
 * Redis health check.
 * @returns Health status
 */
export async function checkRedisHealth(): Promise<"healthy" | "unhealthy" | "not_configured"> {
  if (!redisClient) {
    return "not_configured";
  }

  try {
    const result = await redisClient.ping();
    return result === "PONG" ? "healthy" : "unhealthy";
  } catch {
    return "unhealthy";
  }
}