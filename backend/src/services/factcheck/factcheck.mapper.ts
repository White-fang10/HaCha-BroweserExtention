/**
 * Fact-Check Rating Mapper - Phase 7
 *
 * Maps external fact-check ratings (Google Fact Check API) to HaCha's
 * strict verdict taxonomy: SUPPORTED, FALSE, MISLEADING, UNVERIFIED
 */

import { Verdict, VerificationSource } from "../../types/api.js";
import { ExternalFactCheck, RatingMapping, DEFAULT_RATING_MAPPING, MatchType } from "../../types/factcheck.js";
import { logger } from "../../utils/logger.js";

/** Rating mapping result */
export interface RatingMapResult {
  verdict: Verdict;
  confidence: number;
  explanation: string;
}

/**
 * Normalize external rating for lookup
 * Lowercase, trim, remove punctuation
 */
function normalizeRating(rating: string): string {
  return rating
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Find best mapping for an external rating
 * Returns the mapped verdict and confidence
 */
function mapExternalRating(externalRating: string, mapping: RatingMapping = DEFAULT_RATING_MAPPING): RatingMapResult {
  const normalized = normalizeRating(externalRating);

  // Direct lookup
  if (mapping[normalized] !== undefined) {
    const verdict = mapping[normalized];
    if (verdict !== "UNVERIFIED") {
      return {
        verdict,
        confidence: 0.9, // High confidence for exact matches
        explanation: `Mapped from external rating: "${externalRating}" → ${verdict}`,
      };
    }
    // UNVERIFIED mapped explicitly
    return {
      verdict: "UNVERIFIED",
      confidence: 0.8,
      explanation: `External rating indicates unverified: "${externalRating}"`,
    };
  }

  // Fuzzy matching for common variations
  // Check for partial matches
  const fuzzyMappings: { pattern: RegExp; verdict: Verdict; confidence: number }[] = [
    // SUPPORTED patterns
    { pattern: /^(true|correct|accurate|verified|supported|confirmed|valid)$/, verdict: "SUPPORTED", confidence: 0.85 },
    { pattern: /^(mostly|generally)\s+(true|accurate|correct)$/, verdict: "SUPPORTED", confidence: 0.75 },

    // FALSE patterns
    { pattern: /^(false|incorrect|wrong|inaccurate|debunked|fabricated|fictional)$/, verdict: "FALSE", confidence: 0.85 },
    { pattern: /^pants\s+on\s+fire$/, verdict: "FALSE", confidence: 0.9 },
    { pattern: /^four\s+pinocchios?$/, verdict: "FALSE", confidence: 0.9 },
    { pattern: /^completely\s+false$/, verdict: "FALSE", confidence: 0.85 },
    { pattern: /^mostly\s+false$/, verdict: "FALSE", confidence: 0.75 },

    // MISLEADING patterns
    { pattern: /^(misleading|half\s+true|mostly\s+true|missing\s+context|out\s+of\s+context|exaggerated|cherry\s+picked)$/, verdict: "MISLEADING", confidence: 0.8 },
    { pattern: /^three\s+pinocchios?$/, verdict: "MISLEADING", confidence: 0.85 },
    { pattern: /^two\s+pinocchios?$/, verdict: "MISLEADING", confidence: 0.8 },
    { pattern: /^one\s+pinocchio$/, verdict: "MISLEADING", confidence: 0.7 },

    // UNVERIFIED patterns
    { pattern: /^(unverified|unproven|unsubstantiated|unsupported|no\s+evidence|insufficient\s+evidence|needs?\s+context|unconfirmed|unclear|opinion|satire)$/, verdict: "UNVERIFIED", confidence: 0.8 },
  ];

  for (const { pattern, verdict, confidence } of fuzzyMappings) {
    if (pattern.test(normalized)) {
      return {
        verdict,
        confidence,
        explanation: `Fuzzy matched "${externalRating}" → ${verdict}`,
      };
    }
  }

  // Unknown rating - conservative default
  logger.warn("Unknown external rating, defaulting to UNVERIFIED", { externalRating, normalized });
  return {
    verdict: "UNVERIFIED",
    confidence: 0.3,
    explanation: `Unknown rating "${externalRating}", conservative UNVERIFIED`,
  };
}

/**
 * Map a fact-check candidate to HaCha verdict
 * Combines rating mapping with match confidence
 */
export function mapFactCheckToVerdict(
  externalFactCheck: ExternalFactCheck,
  matchType: MatchType,
  matchConfidence: number,
  matchScore: {
    textSimilarity: number;
    entityAgreement: number;
    numberAgreement: number;
    dateAgreement: number;
    negationAgreement: number;
  }
): RatingMapResult {
  // First, map the external rating
  const ratingResult = mapExternalRating(externalFactCheck.review.textualRating);

  // Adjust confidence based on match quality
  let adjustedConfidence = ratingResult.confidence * matchConfidence;

  // Boost for EXACT match
  if (matchType === "EXACT") {
    adjustedConfidence = Math.min(1.0, adjustedConfidence * 1.1);
  }

  // Penalize for LOW_CONFIDENCE match
  if (matchType === "LOW_CONFIDENCE") {
    adjustedConfidence *= 0.7;
  }

  // Safeguard: if critical safeguards failed, force UNVERIFIED
  if (matchScore.negationAgreement === 0 || matchScore.numberAgreement === 0) {
    logger.warn("Critical safeguard mismatch - forcing UNVERIFIED", {
      textualRating: externalFactCheck.review.textualRating,
      matchScore: matchScore,
    });
    return {
      verdict: "UNVERIFIED",
      confidence: 0.1,
      explanation: "Critical safeguard mismatch (negation or numbers) - conservative UNVERIFIED",
    };
  }

  // If mapped to UNVERIFIED but match is strong, keep UNVERIFIED but note it
  if (ratingResult.verdict === "UNVERIFIED" && matchType === "EXACT") {
    return {
      verdict: "UNVERIFIED",
      confidence: Math.max(0.5, adjustedConfidence),
      explanation: `${ratingResult.explanation} (but strong text match)`,
    };
  }

  // Build detailed explanation
  const publisherName = externalFactCheck.publisher?.name || "Unknown publisher";
  const reviewUrl = externalFactCheck.review.url;

  const explanation = `${ratingResult.explanation}. ` +
    `Source: ${publisherName} (${reviewUrl}). ` +
    `Match: ${matchType} (${(matchConfidence * 100).toFixed(1)}% text similarity).`;

  return {
    verdict: ratingResult.verdict,
    confidence: Math.round(adjustedConfidence * 1000) / 1000,
    explanation,
  };
}

/**
 * Create sources array for verification result
 */
export function createVerificationSources(
  externalFactCheck: ExternalFactCheck,
  matchType: MatchType,
  mappedVerdict: Verdict
): VerificationSource[] {
  return [
    {
      title: externalFactCheck.review.title || externalFactCheck.claimant || externalFactCheck.publisher?.name || "Fact Check",
      url: externalFactCheck.review.url,
      publisher: externalFactCheck.publisher?.name || "Google Fact Check",
      publishDate: externalFactCheck.review.reviewDate || new Date().toISOString(),
      reliabilityScore: matchType === "EXACT" ? 0.95 : matchType === "HIGH_CONFIDENCE" ? 0.85 : 0.7,
    },
  ];
}

/**
 * Generate human-readable explanation for the fact-check result
 */
export function generateExplanation(
  externalFactCheck: ExternalFactCheck,
  matchType: MatchType,
  mappedVerdict: Verdict,
  matchConfidence: number
): string {
  const publisher = externalFactCheck.publisher?.name || "a fact-check organization";
  const rating = externalFactCheck.review.textualRating;
  const claimText = externalFactCheck.claimText;

  const matchDescriptions: Record<MatchType, string> = {
    EXACT: "exactly matches",
    HIGH_CONFIDENCE: "closely matches",
    LOW_CONFIDENCE: "partially matches",
    NO_MATCH: "does not match",
  };

  const matchDesc = matchDescriptions[matchType] || "matches";

  return `This claim ${matchDesc} a fact-check by ${publisher} ` +
    `which rated it "${rating}" (${mappedVerdict}). ` +
    `Match confidence: ${(matchConfidence * 100).toFixed(1)}%. ` +
    `Original claim: "${claimText.substring(0, 200)}${claimText.length > 200 ? "..." : ""}"`;
}