/**
 * Security Headers Middleware - Phase 12
 * Adds security-related HTTP headers to all responses.
 */

import { Request, Response, NextFunction } from "express";

/**
 * Default security headers configuration
 */
export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string;
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: "same-origin" | "same-site" | "cross-origin";
  dnsPrefetchControl?: boolean;
  expectCT?: { maxAge: number; enforce: boolean };
  frameguard?: "deny" | "sameorigin" | "allow-from";
  hsts?: { maxAge: number; includeSubDomains: boolean; preload: boolean };
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: "none" | "master-only" | "by-content-type" | "by-ftp-filename";
  referrerPolicy?: string;
  xssFilter?: boolean;
}

/**
 * Create security headers middleware with sensible defaults.
 */
export function createSecurityHeadersMiddleware(config: SecurityHeadersConfig = {}) {
  const defaults: SecurityHeadersConfig = {
    contentSecurityPolicy: "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: "same-origin",
    dnsPrefetchControl: true,
    expectCT: { maxAge: 86400, enforce: true },
    frameguard: "deny",
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: "none",
    referrerPolicy: "strict-origin-when-cross-origin",
    xssFilter: true,
  };

  const merged = { ...defaults, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Content Security Policy
    if (merged.contentSecurityPolicy) {
      res.setHeader("Content-Security-Policy", merged.contentSecurityPolicy);
    }

    // Cross-Origin Embedder Policy
    if (merged.crossOriginEmbedderPolicy) {
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    }

    // Cross-Origin Opener Policy
    if (merged.crossOriginOpenerPolicy) {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    }

    // Cross-Origin Resource Policy
    if (merged.crossOriginResourcePolicy) {
      res.setHeader("Cross-Origin-Resource-Policy", merged.crossOriginResourcePolicy);
    }

    // DNS Prefetch Control
    if (merged.dnsPrefetchControl) {
      res.setHeader("X-DNS-Prefetch-Control", "off");
    }

    // Expect-CT
    if (merged.expectCT) {
      const { maxAge, enforce } = merged.expectCT;
      const value = enforce
        ? `max-age=${maxAge}, enforce`
        : `max-age=${maxAge}`;
      res.setHeader("Expect-CT", value);
    }

    // X-Frame-Options (legacy, but still useful)
    if (merged.frameguard) {
      const value = merged.frameguard === "deny"
        ? "DENY"
        : merged.frameguard === "sameorigin"
          ? "SAMEORIGIN"
          : `ALLOW-FROM ${merged.frameguard}`;
      res.setHeader("X-Frame-Options", value);
    }

    // Strict-Transport-Security (HSTS)
    if (merged.hsts) {
      const { maxAge, includeSubDomains, preload } = merged.hsts;
      let value = `max-age=${maxAge}`;
      if (includeSubDomains) value += "; includeSubDomains";
      if (preload) value += "; preload";
      res.setHeader("Strict-Transport-Security", value);
    }

    // X-Download-Options (IE)
    if (merged.ieNoOpen) {
      res.setHeader("X-Download-Options", "noopen");
    }

    // X-Content-Type-Options
    if (merged.noSniff) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }

    // Origin-Agent-Cluster
    if (merged.originAgentCluster) {
      res.setHeader("Origin-Agent-Cluster", "?1");
    }

    // X-Permitted-Cross-Domain-Policies
    if (merged.permittedCrossDomainPolicies) {
      res.setHeader("X-Permitted-Cross-Domain-Policies", merged.permittedCrossDomainPolicies);
    }

    // Referrer-Policy
    if (merged.referrerPolicy) {
      res.setHeader("Referrer-Policy", merged.referrerPolicy);
    }

    // X-XSS-Protection (legacy, but still useful for older browsers)
    if (merged.xssFilter) {
      res.setHeader("X-XSS-Protection", "1; mode=block");
    }

    // Remove Server header (information disclosure)
    res.removeHeader("X-Powered-By");

    next();
  };
}

/**
 * Pre-configured security headers for different environments.
 */
export const securityHeaders = {
  // Production configuration
  production: createSecurityHeadersMiddleware({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),

  // Development configuration (less strict CSP)
  development: createSecurityHeadersMiddleware({
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:*; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
    hsts: { maxAge: 0, includeSubDomains: false, preload: false },
  }),

  // API-only configuration (no HTML content)
  api: createSecurityHeadersMiddleware({
    contentSecurityPolicy: "default-src 'none'; frame-ancestors 'none';",
    crossOriginResourcePolicy: "same-origin",
  }),
};

export {};