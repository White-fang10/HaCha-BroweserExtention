/**
 * Google Fact Check Tools API Client - Phase 7
 *
 * Handles HTTP requests to Google Fact Check Claim Search API.
 * Isolated from business logic for testability and provider extensibility.
 */

import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { ExternalFactCheck, FactCheckProviderResult, ProviderStatus } from "../../types/factcheck.js";

/** Google API response types (minimal schema for validation) */
interface GoogleClaimReview {
  publisher?: {
    name?: string;
    site?: string;
  };
  url?: string;
  title?: string;
  reviewDate?: string;
  textualRating?: string;
}

interface GoogleClaim {
  text?: string;
  claimant?: string;
  claimDate?: string;
  claimReview?: GoogleClaimReview[];
}

interface GoogleSearchResponse {
  claims?: GoogleClaim[];
  nextPageToken?: string;
}

/** Google Fact Check API Client */
export class GoogleFactCheckClient {
  private readonly baseUrl = "https://factchecktools.googleapis.com/v1alpha1/claims:search";
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly languageCode: string;
  private readonly pageSize: number;
  private readonly maxAgeDays: number | null;

  constructor() {
    this.apiKey = env.googleFactCheckApiKey;
    this.timeoutMs = env.factCheckTimeoutMs;
    this.languageCode = env.factCheckLanguage;
    this.pageSize = env.factCheckPageSize;
    this.maxAgeDays = env.factCheckMaxAgeDays;
  }

  /**
   * Search for fact-checks matching a claim
   * @param normalizedClaim - The normalized claim text
   * @param requestId - Request ID for logging
   * @returns Provider result with candidates
   */
  async searchClaim(normalizedClaim: string, requestId: string): Promise<FactCheckProviderResult> {
    const startTime = Date.now();

    if (!this.apiKey) {
      logger.warn("Google Fact Check API key not configured", { requestId });
      return {
        status: "ERROR",
        results: [],
        provider: "google-factcheck",
        errorCode: "MISSING_API_KEY",
        errorMessage: "Google Fact Check API key not configured",
      };
    }

    // Build query with bounded length (Google has query length limits)
    const query = this.buildSearchQuery(normalizedClaim);

    const params = new URLSearchParams({
      query,
      languageCode: this.languageCode,
      pageSize: String(this.pageSize),
      key: this.apiKey,
    });

    if (this.maxAgeDays !== null) {
      params.set("maxAgeDays", String(this.maxAgeDays));
    }

    const url = `${this.baseUrl}?${params.toString()}`;

    logger.debug("Google Fact Check API request", {
      requestId,
      url: this.baseUrl,
      queryLength: query.length,
      languageCode: this.languageCode,
      pageSize: this.pageSize,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "HaCha-FactChecker/1.0",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        logger.warn("Google Fact Check API error", {
          requestId,
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          durationMs,
        });

        let errorCode = "API_ERROR";
        if (response.status === 400) errorCode = "BAD_REQUEST";
        else if (response.status === 401 || response.status === 403) errorCode = "AUTH_ERROR";
        else if (response.status === 429) errorCode = "QUOTA_EXCEEDED";
        else if (response.status >= 500) errorCode = "SERVER_ERROR";

        return {
          status: "ERROR",
          results: [],
          provider: "google-factcheck",
          errorCode,
          errorMessage: `Google API error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json() as GoogleSearchResponse;

      logger.debug("Google Fact Check API response", {
        requestId,
        claimsCount: data.claims?.length ?? 0,
        durationMs,
      });

      // Convert to internal model
      const results = this.parseResponse(data, requestId);

      return {
        status: results.length > 0 ? "MATCH" : "NO_MATCH",
        results,
        provider: "google-factcheck",
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof DOMException && error.name === "AbortError") {
        logger.warn("Google Fact Check API timeout", { requestId, durationMs, timeoutMs: this.timeoutMs });
        return {
          status: "ERROR",
          results: [],
          provider: "google-factcheck",
          errorCode: "TIMEOUT",
          errorMessage: `Request timed out after ${this.timeoutMs}ms`,
        };
      }

      logger.error("Google Fact Check API request failed", {
        requestId,
        error: (error as Error).message,
        durationMs,
      });

      return {
        status: "ERROR",
        results: [],
        provider: "google-factcheck",
        errorCode: "NETWORK_ERROR",
        errorMessage: `Network error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Build search query from normalized claim
   * Bounds length to avoid API limits
   */
  private buildSearchQuery(normalizedClaim: string): string {
    // Google's query parameter has practical limits
    // Use first 2000 chars of normalized claim as query
    // This preserves numbers, entities, negation which are in the normalized text
    const maxQueryLength = 2000;
    if (normalizedClaim.length <= maxQueryLength) {
      return normalizedClaim;
    }

    // If too long, try to preserve key elements (numbers, entities, negation)
    // by taking from start and end
    const start = normalizedClaim.substring(0, 1000);
    const end = normalizedClaim.substring(normalizedClaim.length - 1000);
    return `${start} ... ${end}`;
  }

  /**
   * Parse and validate Google API response into internal model
   */
  private parseResponse(data: GoogleSearchResponse, requestId: string): ExternalFactCheck[] {
    const results: ExternalFactCheck[] = [];

    if (!data.claims || !Array.isArray(data.claims)) {
      return results;
    }

    for (const claim of data.claims) {
      try {
        const parsed = this.parseClaim(claim);
        if (parsed) {
          results.push(parsed);
        }
      } catch (error) {
        logger.warn("Failed to parse Google claim", {
          requestId,
          error: (error as Error).message,
        });
        // Skip invalid claims but continue processing others
      }
    }

    return results;
  }

  /**
   * Parse a single Google claim into internal ExternalFactCheck
   */
  private parseClaim(claim: GoogleClaim): ExternalFactCheck | null {
    // Validate required fields
    if (!claim.text || !claim.claimReview || !Array.isArray(claim.claimReview) || claim.claimReview.length === 0) {
      return null;
    }

    // Use the first review (most relevant)
    const review = claim.claimReview[0];

    if (!review.url || !review.textualRating) {
      return null;
    }

    // Validate URL
    try {
      new URL(review.url);
    } catch {
      logger.warn("Invalid review URL from Google", { url: review.url });
      return null;
    }

    return {
      claimText: claim.text,
      claimant: claim.claimant,
      claimDate: claim.claimDate,
      publisher: {
        name: review.publisher?.name || "Unknown Publisher",
        site: review.publisher?.site,
      },
      review: {
        title: review.title,
        url: review.url,
        reviewDate: review.reviewDate,
        textualRating: review.textualRating,
      },
    };
  }

  /**
   * Health check for the provider
   */
  async healthCheck(requestId: string): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();

    if (!this.apiKey) {
      return { healthy: false, error: "API key not configured" };
    }

    // Simple test query
    const testQuery = "test claim";
    const params = new URLSearchParams({
      query: testQuery,
      languageCode: this.languageCode,
      pageSize: "1",
      key: this.apiKey,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (response.ok || response.status === 400) {
        // 400 might be invalid test query but API is reachable
        return { healthy: true, latencyMs };
      }

      if (response.status === 401 || response.status === 403) {
        return { healthy: false, latencyMs, error: "Invalid API key" };
      }

      return { healthy: false, latencyMs, error: `HTTP ${response.status}` };
    } catch (error) {
      return { healthy: false, latencyMs: Date.now() - startTime, error: (error as Error).message };
    }
  }
}

/** Singleton instance */
let googleFactCheckClient: GoogleFactCheckClient | null = null;

/** Get or create the Google Fact Check client */
export function getGoogleFactCheckClient(): GoogleFactCheckClient {
  if (!googleFactCheckClient) {
    googleFactCheckClient = new GoogleFactCheckClient();
  }
  return googleFactCheckClient;
}