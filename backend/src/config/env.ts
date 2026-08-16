/**
 * Environment configuration with validation.
 * All configuration values are validated at startup.
 */
import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  extensionOrigin: string;
  corsOrigin: string;
  maxClaimLength: number;
  logLevel: string;
  redisUrl: string;
  mongodbUri: string;
  aiServiceUrl: string;
  aiServiceToken: string;
  // Cache configuration
  cacheTtlSeconds: number;
  cacheKeyPrefix: string;
  cacheSchemaVersion: string;
  cacheEnabled: boolean;
  cacheConnectTimeoutMs: number;
  cacheCommandTimeoutMs: number;
  cacheMaxRetries: number;
  // Google Fact Check API configuration
  googleFactCheckApiKey: string;
  factCheckEnabled: boolean;
  factCheckLanguage: string;
  factCheckPageSize: number;
  factCheckMaxAgeDays: number | null;
  factCheckTimeoutMs: number;
  factCheckNoMatchTtlSeconds: number;
  // AI Service configuration
  aiServiceEnabled: boolean;
  aiServiceTimeoutMs: number;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvInt(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be an integer, got: ${value}`);
  }
  return parsed;
}

function getEnvBool(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.toLowerCase() === "true";
}

function getEnvIntNullable(key: string, defaultValue?: number | null): number | null {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be an integer, got: ${value}`);
  }
  return parsed;
}

export const env: EnvConfig = {
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: getEnvInt("PORT", 3000),
  extensionOrigin: getEnv("EXTENSION_ORIGIN", "chrome-extension://*"),
  corsOrigin: getEnv("CORS_ORIGIN", "chrome-extension://*"),
  maxClaimLength: getEnvInt("MAX_CLAIM_LENGTH", 5000),
  logLevel: getEnv("LOG_LEVEL", "info"),
  redisUrl: getEnv("REDIS_URL", "redis://localhost:6379"),
  mongodbUri: getEnv("MONGODB_URI", "mongodb://localhost:27017/hacha"),
  aiServiceUrl: getEnv("AI_SERVICE_URL", "http://localhost:8000"),
  aiServiceToken: getEnv("AI_SERVICE_TOKEN", "development-secret"),
  // Cache configuration
  cacheTtlSeconds: getEnvInt("CACHE_TTL_SECONDS", 86400),
  cacheKeyPrefix: getEnv("CACHE_KEY_PREFIX", "hacha:claim"),
  cacheSchemaVersion: getEnv("CACHE_SCHEMA_VERSION", "v1"),
  cacheEnabled: getEnvBool("CACHE_ENABLED", true),
  cacheConnectTimeoutMs: getEnvInt("CACHE_CONNECT_TIMEOUT_MS", 5000),
  cacheCommandTimeoutMs: getEnvInt("CACHE_COMMAND_TIMEOUT_MS", 2000),
  cacheMaxRetries: getEnvInt("CACHE_MAX_RETRIES", 3),
  // Google Fact Check API configuration
  googleFactCheckApiKey: getEnv("GOOGLE_FACTCHECK_API_KEY", ""),
  factCheckEnabled: getEnvBool("FACTCHECK_ENABLED", true),
  factCheckLanguage: getEnv("FACTCHECK_LANGUAGE", "en"),
  factCheckPageSize: getEnvInt("FACTCHECK_PAGE_SIZE", 10),
  factCheckMaxAgeDays: getEnvIntNullable("FACTCHECK_MAX_AGE_DAYS", null),
  factCheckTimeoutMs: getEnvInt("FACTCHECK_TIMEOUT_MS", 5000),
  factCheckNoMatchTtlSeconds: getEnvInt("FACTCHECK_NO_MATCH_TTL_SECONDS", 900),
  // AI Service configuration
  aiServiceEnabled: getEnvBool("AI_SERVICE_ENABLED", false),
  aiServiceTimeoutMs: getEnvInt("AI_SERVICE_TIMEOUT_MS", 30000),
};

export function validateEnv(): void {
  // Validate critical configuration
  if (env.port <= 0 || env.port > 65535) {
    throw new Error(`Invalid PORT: ${env.port}`);
  }
  if (env.maxClaimLength <= 0) {
    throw new Error(`Invalid MAX_CLAIM_LENGTH: ${env.maxClaimLength}`);
  }
  if (!env.extensionOrigin) {
    throw new Error("EXTENSION_ORIGIN must be set");
  }
  if (!["development", "staging", "production"].includes(env.nodeEnv)) {
    throw new Error(`NODE_ENV must be one of: development, staging, production. Got: ${env.nodeEnv}`);
  }
  if (env.cacheTtlSeconds <= 0) {
    throw new Error(`Invalid CACHE_TTL_SECONDS: ${env.cacheTtlSeconds}`);
  }
  if (env.cacheConnectTimeoutMs <= 0) {
    throw new Error(`Invalid CACHE_CONNECT_TIMEOUT_MS: ${env.cacheConnectTimeoutMs}`);
  }
  if (env.cacheCommandTimeoutMs <= 0) {
    throw new Error(`Invalid CACHE_COMMAND_TIMEOUT_MS: ${env.cacheCommandTimeoutMs}`);
  }
  if (env.cacheMaxRetries < 0) {
    throw new Error(`Invalid CACHE_MAX_RETRIES: ${env.cacheMaxRetries}`);
  }
  if (env.factCheckEnabled && !env.googleFactCheckApiKey) {
    throw new Error("GOOGLE_FACTCHECK_API_KEY is required when FACTCHECK_ENABLED=true");
  }
  if (env.factCheckPageSize <= 0 || env.factCheckPageSize > 100) {
    throw new Error(`Invalid FACTCHECK_PAGE_SIZE: ${env.factCheckPageSize} (must be 1-100)`);
  }
  if (env.factCheckTimeoutMs <= 0) {
    throw new Error(`Invalid FACTCHECK_TIMEOUT_MS: ${env.factCheckTimeoutMs}`);
  }
  if (env.factCheckNoMatchTtlSeconds < 0) {
    throw new Error(`Invalid FACTCHECK_NO_MATCH_TTL_SECONDS: ${env.factCheckNoMatchTtlSeconds}`);
  }
  if (env.aiServiceEnabled) {
    if (!env.aiServiceUrl) {
      throw new Error("AI_SERVICE_URL is required when AI_SERVICE_ENABLED=true");
    }
    if (!env.aiServiceToken) {
      throw new Error("AI_SERVICE_TOKEN is required when AI_SERVICE_ENABLED=true");
    }
    if (env.aiServiceTimeoutMs <= 0) {
      throw new Error(`Invalid AI_SERVICE_TIMEOUT_MS: ${env.aiServiceTimeoutMs}`);
    }
  }
}

export default env;