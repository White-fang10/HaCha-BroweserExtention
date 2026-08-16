/**
 * Cache Types - Phase 6
 *
 * Defines the data structures for Redis caching.
 */

import { Verdict, VerificationSource } from "./api.js";

/** Cache schema version */
export const CACHE_SCHEMA_VERSION = "v1" as const;

/** Cached verification result stored in Redis */
export interface CachedVerification {
  /** Cache schema version */
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  /** SHA-256 hash of the normalized claim (also in key) */
  claimHash: string;
  /** Canonical normalized claim text */
  normalizedClaim: string;
  /** Verification verdict */
  verdict: Verdict;
  /** Confidence score (0-1) */
  confidence: number;
  /** Human-readable explanation */
  explanation: string;
  /** Source references */
  sources: VerificationSource[];
  /** Source tier that produced this result */
  sourceTier: "REDIS_CACHE" | "FACT_CHECK_API" | "AI_RAG";
  /** ISO timestamp when cached */
  createdAt: string;
  /** ISO timestamp when entry expires */
  expiresAt: string;
}

/** Configuration for cache service */
export interface CacheConfig {
  /** Redis connection URL */
  redisUrl: string;
  /** Default TTL in seconds */
  defaultTtlSeconds: number;
  /** Cache key prefix */
  keyPrefix: string;
  /** Cache schema version */
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  /** Whether cache is enabled */
  enabled: boolean;
  /** Connection timeout in ms */
  connectTimeoutMs: number;
  /** Command timeout in ms */
  commandTimeoutMs: number;
  /** Max retries */
  maxRetries: number;
}

/** Cache operation result */
export interface CacheGetResult {
  /** Whether the entry was found and valid */
  hit: boolean;
  /** The cached verification (if hit) */
  verification: CachedVerification | null;
  /** Lookup duration in ms */
  lookupDurationMs: number;
}

/** Cache set result */
export interface CacheSetResult {
  /** Whether the set succeeded */
  success: boolean;
  /** Write duration in ms */
  writeDurationMs: number;
}

/** Cache metrics */
export interface CacheMetrics {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Total cache errors */
  errors: number;
  /** Total successful sets */
  setSuccess: number;
  /** Total failed sets */
  setFailures: number;
  /** Total lookup latency in ms */
  totalLookupLatencyMs: number;
  /** Total write latency in ms */
  totalWriteLatencyMs: number;
}