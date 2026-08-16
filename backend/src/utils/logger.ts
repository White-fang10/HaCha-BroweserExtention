/**
 * Structured logging utility for the HaCha backend.
 * Privacy-aware: avoids logging sensitive claim content by default.
 */
import { env } from "../config/env.js";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  claimLength?: number;
  claimHash?: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = (env.logLevel as LogLevel) || "info";
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.level];
  }

  private format(entry: LogEntry): string {
    // In development, pretty print; in production, JSON
    if (env.nodeEnv === "development") {
      const parts = [
        entry.timestamp,
        `[${entry.level.toUpperCase()}]`,
        entry.message,
        entry.requestId ? `reqId=${entry.requestId}` : "",
        entry.method ? `method=${entry.method}` : "",
        entry.path ? `path=${entry.path}` : "",
        entry.statusCode ? `status=${entry.statusCode}` : "",
        entry.durationMs ? `duration=${entry.durationMs}ms` : "",
        entry.claimLength !== undefined ? `claimLen=${entry.claimLength}` : "",
        entry.claimHash ? `claimHash=${entry.claimHash}` : "",
        entry.error ? `error=${entry.error}` : "",
        entry.stack ? `stack=${entry.stack}` : "",
      ].filter(Boolean);
      return parts.join(" ");
    }
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, meta: Partial<LogEntry> = {}): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    // Use console.error for error level, console.log for others
    if (level === "error") {
      console.error(this.format(entry));
    } else {
      console.log(this.format(entry));
    }
  }

  debug(message: string, meta?: Partial<LogEntry>): void {
    this.log("debug", message, meta);
  }

  info(message: string, meta?: Partial<LogEntry>): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Partial<LogEntry>): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Partial<LogEntry>): void {
    this.log("error", message, meta);
  }

  /**
   * Log an incoming HTTP request.
   * Does NOT log the claim content for privacy.
   */
  logRequest(
    requestId: string,
    method: string,
    path: string,
    claimLength?: number
  ): void {
    this.info("Incoming request", {
      requestId,
      method,
      path,
      claimLength,
    });
  }

  /**
   * Log an outgoing HTTP response.
   */
  logResponse(
    requestId: string,
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
  ): void {
    this.info("Outgoing response", {
      requestId,
      method,
      path,
      statusCode,
      durationMs,
    });
  }

  /**
   * Log verification result (without sensitive content).
   */
  logVerification(
    requestId: string,
    verdict: string,
    confidence: number,
    sourceTier: string,
    cached: boolean,
    durationMs: number
  ): void {
    this.info("Verification complete", {
      requestId,
      verdict,
      confidence,
      sourceTier,
      cached,
      durationMs,
    });
  }
}

export const logger = new Logger();
export default logger;