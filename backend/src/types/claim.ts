/**
 * Claim Identity Types - Phase 5
 *
 * Defines the data structures for claim normalization and identity generation.
 */

/** Normalization version - increment when algorithm changes */
export const NORMALIZATION_VERSION = "v1" as const;

/** Metadata extracted from claim during normalization */
export interface ClaimMetadata {
  /** Hashtags found in claim (without #) */
  hashtags: string[];
  /** Mentions found in claim (without @) */
  mentions: string[];
  /** URLs found in claim */
  urls: string[];
  /** Numbers found in claim (preserved as strings) */
  numbers: string[];
  /** Dates found in claim */
  dates: string[];
  /** Percentages found in claim */
  percentages: string[];
  /** Units found in claim (e.g., "5 km", "100 kg") */
  units: string[];
  /** Currency values found in claim */
  currency: string[];
  /** Named entities found in claim */
  entities: string[];
  /** Negation words found in claim */
  negation: string[];
}

/** Result of claim normalization */
export interface NormalizedClaim {
  /** Original raw claim text */
  originalText: string;
  /** Canonical normalized representation */
  normalizedText: string;
  /** Warnings about ambiguous or risky normalization */
  warnings: string[];
  /** Extracted metadata */
  metadata: ClaimMetadata;
}

/** Complete claim identity with hash */
export interface ClaimIdentity {
  /** Original raw claim text */
  originalText: string;
  /** Canonical normalized representation */
  normalizedText: string;
  /** SHA-256 hash of normalized text */
  hash: string;
  /** Normalization algorithm version */
  normalizationVersion: typeof NORMALIZATION_VERSION;
  /** Warnings about normalization */
  warnings: string[];
  /** Extracted metadata */
  metadata: ClaimMetadata;
}

/** Configuration for normalization pipeline */
export interface NormalizationConfig {
  /** Whether to remove decorative punctuation */
  removeDecorativePunctuation: boolean;
  /** Whether to extract hashtags */
  extractHashtags: boolean;
  /** Whether to extract mentions */
  extractMentions: boolean;
  /** Whether to extract URLs */
  extractUrls: boolean;
  /** Whether to apply OCR artifact corrections */
  applyOcrCorrections: boolean;
  /** Maximum claim length to process */
  maxLength: number;
}

/** Default normalization configuration */
export const DEFAULT_NORMALIZATION_CONFIG: NormalizationConfig = {
  removeDecorativePunctuation: true,
  extractHashtags: true,
  extractMentions: true,
  extractUrls: true,
  applyOcrCorrections: true,
  maxLength: 10000,
};