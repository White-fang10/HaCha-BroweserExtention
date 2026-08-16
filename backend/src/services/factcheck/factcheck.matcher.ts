/**
 * Fact-Check Candidate Matcher - Phase 7
 *
 * Implements conservative matching (precision > recall) with safeguards
 * for negation, numbers, entities, and dates to avoid false matches.
 */

import { ExternalFactCheck, FactCheckResult, MatchType, MATCH_WEIGHTS, MATCH_THRESHOLDS } from "../../types/factcheck.js";
import { ClaimMetadata, normalizeWhitespace, extractNumbers, extractEntities, extractNegation, extractDates } from "../claim/index.js";
import { logger } from "../../utils/logger.js";

/** Match score breakdown */
interface MatchScore {
  textSimilarity: number;
  entityAgreement: number;
  numberAgreement: number;
  dateAgreement: number;
  negationAgreement: number;
  total: number;
}

/** Match evaluation result */
interface MatchEvaluation {
  matchType: MatchType;
  confidence: number;
  score: MatchScore;
  matchedClaim: ExternalFactCheck;
}

/**
 * Calculate Jaro-Winkler similarity (approximation for short strings)
 * Better than Levenshtein for fact-check claim matching
 */
function jaroWinklerSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  // For very long strings, use a faster approach
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen > 200) {
    // Use word-based Jaccard for long texts
    return wordJaccardSimilarity(str1, str2);
  }

  const matchWindow = Math.floor(maxLen / 2) - 1;
  if (matchWindow < 0) return 0.0;

  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  transpositions /= 2;

  const m = matches;
  const jaro = (m / str1.length + m / str2.length + (m - transpositions) / m) / 3;

  // Winkler prefix bonus (max 0.1)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, str1.length, str2.length); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Word-based Jaccard similarity for longer texts
 */
function wordJaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }

  const union = words1.size + words2.size - intersection;
  return intersection / union;
}

/**
 * Check if two numbers agree (same value within tolerance)
 * Returns: 1.0 = exact match, 0.5 = close match, 0.0 = mismatch
 */
function compareNumbers(nums1: string[], nums2: string[]): number {
  if (nums1.length === 0 && nums2.length === 0) return 1.0;
  if (nums1.length === 0 || nums2.length === 0) return 0.5; // One has numbers, other doesn't - uncertain

  // Try to find matching numbers
  for (const n1 of nums1) {
    for (const n2 of nums2) {
      const v1 = parseFloat(n1);
      const v2 = parseFloat(n2);
      if (!isNaN(v1) && !isNaN(v2)) {
        if (v1 === v2) return 1.0;
        // Allow small relative difference (5%)
        const relDiff = Math.abs(v1 - v2) / Math.max(Math.abs(v1), Math.abs(v2), 1);
        if (relDiff < 0.05) return 0.8;
      }
      // String match as fallback
      if (n1 === n2) return 1.0;
    }
  }

  return 0.0; // Numbers present but don't match
}

/**
 * Check entity agreement between two claim texts
 * Returns: 1.0 = all entities match, 0.5 = partial, 0.0 = major mismatch
 */
function compareEntities(entities1: string[], entities2: string[]): number {
  if (entities1.length === 0 && entities2.length === 0) return 1.0;
  if (entities1.length === 0 || entities2.length === 0) return 0.5;

  const set1 = new Set(entities1.map(e => e.toLowerCase()));
  const set2 = new Set(entities2.map(e => e.toLowerCase()));

  let matches = 0;
  for (const e of set1) {
    if (set2.has(e)) matches++;
  }

  // Require at least 50% overlap for high agreement
  const overlap = matches / Math.max(set1.size, set2.size);
  if (overlap >= 0.75) return 1.0;
  if (overlap >= 0.4) return 0.6;
  if (overlap > 0) return 0.3;

  return 0.0;
}

/**
 * Check date agreement
 * Returns: 1.0 = same date, 0.5 = same year/month, 0.0 = different
 */
function compareDates(dates1: string[], dates2: string[]): number {
  if (dates1.length === 0 && dates2.length === 0) return 1.0;
  if (dates1.length === 0 || dates2.length === 0) return 0.5;

  // Simple string comparison for now (could parse dates)
  for (const d1 of dates1) {
    for (const d2 of dates2) {
      if (d1 === d2) return 1.0;
      // Check if same year
      const y1 = d1.match(/\b(19|20)\d{2}\b/);
      const y2 = d2.match(/\b(19|20)\d{2}\b/);
      if (y1 && y2 && y1[0] === y2[0]) return 0.6;
    }
  }
  return 0.0;
}

/**
 * Check negation agreement - CRITICAL SAFEGUARD
 * If one claim has negation and the other doesn't, they contradict
 * Returns: 1.0 = both have same negation status, 0.0 = negation mismatch
 */
function compareNegation(negation1: string[], negation2: string[]): number {
  const hasNeg1 = negation1.length > 0;
  const hasNeg2 = negation2.length > 0;

  if (hasNeg1 === hasNeg2) return 1.0; // Both have negation or both don't

  // One has negation, other doesn't - STRONG MISMATCH SIGNAL
  return 0.0;
}

/**
 * Calculate comprehensive match score between user claim and external fact-check
 */
function calculateMatchScore(
  userClaim: string,
  userMetadata: ClaimMetadata,
  externalClaim: ExternalFactCheck
): MatchScore {
  const extMetadata: ClaimMetadata = {
    numbers: extractNumbers(externalClaim.claimText),
    entities: extractEntities(externalClaim.claimText),
    dates: extractDates(externalClaim.claimText),
    negation: extractNegation(externalClaim.claimText),
    hashtags: [],
    mentions: [],
    urls: [],
    percentages: [],
    units: [],
    currency: [],
  };

  // Text similarity (using Jaro-Winkler)
  const textSimilarity = jaroWinklerSimilarity(
    normalizeWhitespace(userClaim),
    normalizeWhitespace(externalClaim.claimText)
  );

  // Entity agreement
  const entityAgreement = compareEntities(userMetadata.entities, extMetadata.entities);

  // Number agreement
  const numberAgreement = compareNumbers(userMetadata.numbers, extMetadata.numbers);

  // Date agreement
  const dateAgreement = compareDates(userMetadata.dates, extMetadata.dates);

  // Negation agreement (CRITICAL)
  const negationAgreement = compareNegation(userMetadata.negation, extMetadata.negation);

  // Weighted total
  const total =
    textSimilarity * MATCH_WEIGHTS.textSimilarity +
    entityAgreement * MATCH_WEIGHTS.entityAgreement +
    numberAgreement * MATCH_WEIGHTS.numberAgreement +
    dateAgreement * MATCH_WEIGHTS.dateAgreement +
    negationAgreement * MATCH_WEIGHTS.negationAgreement;

  return {
    textSimilarity,
    entityAgreement,
    numberAgreement,
    dateAgreement,
    negationAgreement,
    total: Math.round(total * 10000) / 10000, // Round to 4 decimal places
  };
}

/**
 * Determine match type from total score
 */
function determineMatchType(totalScore: number): MatchType {
  if (totalScore >= MATCH_THRESHOLDS.EXACT) return "EXACT";
  if (totalScore >= MATCH_THRESHOLDS.HIGH_CONFIDENCE) return "HIGH_CONFIDENCE";
  if (totalScore >= MATCH_THRESHOLDS.LOW_CONFIDENCE) return "LOW_CONFIDENCE";
  return "NO_MATCH";
}

/**
 * Find the best matching fact-check from candidates
 * Applies conservative matching with safeguards
 */
export function findBestMatch(
  normalizedClaim: string,
  userMetadata: ClaimMetadata,
  candidates: ExternalFactCheck[],
  requestId: string
): MatchEvaluation | null {
  if (!candidates || candidates.length === 0) {
    logger.debug("No candidates to match", { requestId });
    return null;
  }

  logger.debug("Evaluating candidates", {
    requestId,
    candidateCount: candidates.length,
  });

  let bestMatch: MatchEvaluation | null = null;

  for (const candidate of candidates) {
    const score = calculateMatchScore(normalizedClaim, userMetadata, candidate);
    const matchType = determineMatchType(score.total);

    // Only consider matches above LOW_CONFIDENCE threshold
    if (matchType === "NO_MATCH") {
      logger.debug("Candidate below threshold", {
        requestId,
        score: score.total,
        matchedClaim: candidate.claimText.substring(0, 100),
      });
      continue;
    }

    // Negation safeguard: if negation disagrees, downgrade to NO_MATCH
    if (score.negationAgreement === 0.0) {
      logger.warn("Negation mismatch - rejecting match", {
        requestId,
        userNegation: userMetadata.negation,
        candidateNegation: extractNegation(candidate.claimText),
        candidateText: candidate.claimText.substring(0, 150),
      });
      continue;
    }

    // Number safeguard: if numbers present in both but disagree, reject
    if (
      userMetadata.numbers.length > 0 &&
      extractNumbers(candidate.claimText).length > 0 &&
      score.numberAgreement === 0.0
    ) {
      logger.warn("Number mismatch - rejecting match", {
        requestId,
        userNumbers: userMetadata.numbers,
        candidateNumbers: extractNumbers(candidate.claimText),
        candidateText: candidate.claimText.substring(0, 150),
      });
      continue;
    }

    // Entity safeguard: if entities present in both but completely disagree, reject
    if (
      userMetadata.entities.length > 0 &&
      extractEntities(candidate.claimText).length > 0 &&
      score.entityAgreement === 0.0
    ) {
      logger.warn("Entity mismatch - rejecting match", {
        requestId,
        userEntities: userMetadata.entities,
        candidateEntities: extractEntities(candidate.claimText),
        candidateText: candidate.claimText.substring(0, 150),
      });
      continue;
    }

    const evaluation: MatchEvaluation = {
      matchType,
      confidence: score.total,
      score,
      matchedClaim: candidate,
    };

    if (!bestMatch || evaluation.confidence > bestMatch.confidence) {
      bestMatch = evaluation;
    }
  }

  if (bestMatch) {
    logger.info("Best match found", {
      requestId,
      matchType: bestMatch.matchType,
      confidence: bestMatch.confidence,
      matchedClaimPreview: bestMatch.matchedClaim.claimText.substring(0, 150),
    });
  } else {
    logger.debug("No acceptable match found", { requestId });
  }

  return bestMatch;
}

/**
 * Check if a match is reliable enough to act on
 * Conservative: only EXACT and HIGH_CONFIDENCE
 */
export function isMatchReliable(matchType: MatchType): boolean {
  return matchType === "EXACT" || matchType === "HIGH_CONFIDENCE";
}

/**
 * Get human-readable match description
 */
export function getMatchDescription(matchType: MatchType, confidence: number): string {
  switch (matchType) {
    case "EXACT":
      return `Exact match (${(confidence * 100).toFixed(1)}% confidence)`;
    case "HIGH_CONFIDENCE":
      return `High confidence match (${(confidence * 100).toFixed(1)}% confidence)`;
    case "LOW_CONFIDENCE":
      return `Low confidence match (${(confidence * 100).toFixed(1)}% confidence) - needs verification`;
    default:
      return "No reliable match found";
  }
}