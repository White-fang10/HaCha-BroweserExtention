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
}

export default env;