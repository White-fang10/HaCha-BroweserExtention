/**
 * Fact-Check Types - Phase 7
 *
 * Internal types for Google Fact Check Tools API integration.
 * These types are independent of Google's external schema.
 */

import { Verdict, VerificationSource } from "./api.js";

/** Match confidence categories */
export type MatchType = "EXACT" | "HIGH_CONFIDENCE" | "LOW_CONFIDENCE" | "NO_MATCH";

/** Provider status */
export type ProviderStatus = "MATCH" | "NO_MATCH" | "ERROR";

/** External fact-check from Google API (normalized) */
export interface ExternalFactCheck {
  /** The claim text as provided by the fact-check publisher */
  claimText: string;
  /** Who made the original claim (optional) */
  claimant?: string;
  /** When the original claim was made (optional) */
  claimDate?: string;
  /** Publisher information */
  publisher: {
    name: string;
    site?: string;
  };
  /** Review information */
  review: {
    /** Title of the fact-check article */
    title?: string;
    /** URL to the original fact-check */
    url: string;
    /** When the review was published */
    reviewDate?: string;
    /** Original textual rating from publisher (e.g., "False", "Mostly True") */
    textualRating: string;
  };
}

/** Result from a fact-check provider */
export interface FactCheckProviderResult {
  /** Whether a match was found */
  status: ProviderStatus;
  /** Candidate fact-checks (empty if no match) */
  results: ExternalFactCheck[];
  /** Provider identifier */
  provider: string;
  /** Error code if status is ERROR */
  errorCode?: string;
  /** Error message if status is ERROR */
  errorMessage?: string;
}

/** Complete fact-check result after matching and mapping */
export interface FactCheckResult {
  /** Mapped HaCha verdict */
  verdict: Verdict;
  /** Confidence in the match (0-1) */
  matchConfidence: number;
  /** Type of match */
  matchType: MatchType;
  /** Human-readable explanation */
  explanation: string;
  /** Source attribution */
  sources: VerificationSource[];
  /** Provider identifier */
  provider: string;
  /** Original external rating */
  externalRating: string;
  /** Match details */
  matchDetails: {
    /** Normalized user claim */
    userNormalizedClaim: string;
    /** Matched external claim text */
    matchedClaimText: string;
    /** Match score breakdown (optional) */
    score?: {
      textSimilarity: number;
      entityAgreement: number;
      numberAgreement: number;
      dateAgreement: number;
      negationAgreement: number;
    };
  };
  /** When this check was performed */
  checkedAt: string;
}

/** Fact-check provider interface for extensibility */
export interface FactCheckProvider {
  /**
   * Search for fact-checks matching the claim
   * @param claim - Normalized claim to search for
   * @returns Provider result with candidates
   */
  searchClaim(claim: { normalizedText: string; metadata: any }): Promise<FactCheckProviderResult>;
}

/** Rating mapping configuration */
export interface RatingMapping {
  /** Map of external rating (lowercase) to HaCha verdict */
  [externalRating: string]: Verdict | "UNVERIFIED";
}

/** Default rating mapping (conservative) */
export const DEFAULT_RATING_MAPPING: RatingMapping = {
  // SUPPORTED ratings
  "true": "SUPPORTED",
  "correct": "SUPPORTED",
  "accurate": "SUPPORTED",
  "verified": "SUPPORTED",
  "supported": "SUPPORTED",
  "geppetto checkmark": "SUPPORTED", // Washington Post
  "true claim": "SUPPORTED",

  // FALSE ratings
  "false": "FALSE",
  "incorrect": "FALSE",
  "wrong": "FALSE",
  "inaccurate": "FALSE",
  "debunked": "FALSE",
  "fabricated": "FALSE",
  "fictional": "FALSE",
  "pants on fire": "FALSE", // PolitiFact
  "four pinocchios": "FALSE", // Washington Post

  // MISLEADING ratings
  "misleading": "MISLEADING",
  "half true": "MISLEADING",
  "mostly true": "MISLEADING", // Could be MISLEADING or SUPPORTED depending on context
  "mostly false": "MISLEADING",
  "missing context": "MISLEADING",
  "out of context": "MISLEADING",
  "exaggerated": "MISLEADING",
  "cherry picked": "MISLEADING",
  "three pinocchios": "MISLEADING", // Washington Post
  "two pinocchios": "MISLEADING",

  // UNVERIFIED ratings
  "unverified": "UNVERIFIED",
  "unproven": "UNVERIFIED",
  "unsubstantiated": "UNVERIFIED",
  "unsupported": "UNVERIFIED",
  "no evidence": "UNVERIFIED",
  "insufficient evidence": "UNVERIFIED",
  "needs context": "UNVERIFIED",
  "needs more context": "UNVERIFIED",
  "unconfirmed": "UNVERIFIED",
  "unclear": "UNVERIFIED",
  "opinion": "UNVERIFIED",
  "satire": "UNVERIFIED",
  "one pinocchio": "UNVERIFIED", // Washington Post - minor issue
};

/** Match type weights (for reference, not hardcoded) */
export const MATCH_WEIGHTS = {
  textSimilarity: 0.50,
  entityAgreement: 0.20,
  numberAgreement: 0.15,
  dateAgreement: 0.10,
  negationAgreement: 0.05,
} as const;

/** Match thresholds */
export const MATCH_THRESHOLDS = {
  EXACT: 1.0,
  HIGH_CONFIDENCE: 0.85,
  LOW_CONFIDENCE: 0.60,
  // Below 0.60 = NO_MATCH
} as const;