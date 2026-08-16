/**
 * Claim Normalizer - Phase 5
 *
 * Transforms raw OCR/user-entered claim text into a deterministic canonical
 * representation. Normalizes formatting, not meaning.
 *
 * Pipeline order (critical):
 * 1. Unicode normalization (NFKC)
 * 2. Trim
 * 3. Whitespace normalization
 * 4. OCR artifact cleanup
 * 5. Safe punctuation normalization
 * 6. Case normalization
 * 7. URL/entity handling (metadata extraction)
 * 8. Number/date preservation
 * 9. Final canonicalization
 */

import { NormalizedClaim, DEFAULT_NORMALIZATION_CONFIG, NormalizationConfig, ClaimMetadata } from "../../types/claim.js";
import {
  WHITESPACE_REGEX,
  CONTROL_CHAR_REGEX,
  DECORATIVE_PUNCTUATION_PATTERNS,
  EMOJI_REGEX,
  OCR_SPACED_LETTERS_REGEX,
} from "./normalization-rules.js";
import { extractMetadata, removeMetadataFromText } from "./metadata-extractor.js";

/**
 * Normalize a raw claim into canonical form.
 * @param text - Raw claim text
 * @param config - Normalization configuration
 * @returns Normalized claim with metadata and warnings
 */
export function normalizeClaim(
  text: string,
  config: NormalizationConfig = DEFAULT_NORMALIZATION_CONFIG
): NormalizedClaim {
  const warnings: string[] = [];
  const originalText = text;

  // Guard against extremely long input
  if (text.length > config.maxLength) {
    warnings.push("Input exceeds maximum length, truncated");
    text = text.substring(0, config.maxLength);
  }

  // Step 1: Unicode normalization (NFKC)
  let normalized = unicodeNormalize(text);

  // Step 2: Trim
  normalized = normalized.trim();

  // Step 3: Whitespace normalization
  normalized = normalizeWhitespace(normalized);

  // Step 4: OCR artifact cleanup (conservative)
  if (config.applyOcrCorrections) {
    normalized = cleanupOcrArtifacts(normalized, warnings);
  }

  // Step 5: Safe punctuation normalization
  if (config.removeDecorativePunctuation) {
    normalized = normalizePunctuation(normalized);
  }

  // Step 6: Metadata extraction BEFORE case normalization
  // This preserves case-sensitive patterns like URLs, hashtags, mentions
  const metadata: ClaimMetadata = extractMetadata(normalized);

  if (config.extractHashtags || config.extractMentions || config.extractUrls) {
    normalized = removeMetadataFromText(normalized, {
      extractHashtags: config.extractHashtags,
      extractMentions: config.extractMentions,
      extractUrls: config.extractUrls,
    });
    // Re-normalize whitespace after removal
    normalized = normalizeWhitespace(normalized).trim();
  }

  // Step 7: Case normalization (lowercase for canonical form)
  normalized = normalized.toLowerCase();

  // Step 8: Number/date preservation - already preserved by not altering them
  // Check for ambiguous dates
  if (metadata.dates.some(d => /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(d))) {
    warnings.push("Ambiguous date format detected (locale-dependent)");
  }

  // Step 9: Final canonicalization
  normalized = finalCanonicalize(normalized);

  return {
    originalText,
    normalizedText: normalized,
    warnings,
    metadata,
  };
}

/**
 * Step 1: Unicode normalization using NFKC.
 * NFKC composes characters and converts compatibility equivalents.
 */
function unicodeNormalize(text: string): string {
  if (typeof text.normalize === "function") {
    try {
      return text.normalize("NFKC");
    } catch {
      // If normalization fails, return original
      return text;
    }
  }
  return text;
}

/**
 * Step 2/3: Trim and collapse whitespace.
 * Exported for use in matching module.
 */
export function normalizeWhitespace(text: string): string {
  // Replace control characters with space
  let result = text.replace(CONTROL_CHAR_REGEX, " ");
  // Replace all unicode whitespace with single space
  result = result.replace(WHITESPACE_REGEX, " ");
  // Collapse multiple spaces
  result = result.replace(/\s{2,}/g, " ");
  return result.trim();
}

/**
 * Step 4: Conservative OCR artifact cleanup.
 * Only applies safe, well-tested corrections.
 */
function cleanupOcrArtifacts(text: string, warnings: string[]): string {
  let result = text;

  // Remove decorative emoji (keep original text for reference)
  const emojiMatches = result.match(EMOJI_REGEX);
  if (emojiMatches && emojiMatches.length > 0) {
    warnings.push("Decorative emoji removed from canonical claim");
  }
  result = result.replace(EMOJI_REGEX, " ");

  // Fix spaced-out all-caps acronyms: "N A S A" → "NASA"
  result = result.replace(OCR_SPACED_LETTERS_REGEX, (match) => {
    const letters = match.replace(/\s/g, "");
    // Only collapse if all letters are uppercase and 2-5 chars
    if (/^[A-Z]{2,5}$/.test(letters)) {
      return letters;
    }
    return match;
  });

  // Re-normalize whitespace after emoji removal
  result = normalizeWhitespace(result);

  return result;
}

/**
 * Step 5: Safe punctuation normalization.
 * Reduces decorative repeated punctuation without altering meaning.
 * Preserves: %, $, -, /, ., :, @, # in meaningful contexts
 */
function normalizePunctuation(text: string): string {
  let result = text;

  // Apply decorative punctuation patterns
  for (const [pattern, replacement] of DECORATIVE_PUNCTUATION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Remove remaining standalone punctuation except:
  // - apostrophes in words (don't, NASA's)
  // - percent sign %
  // - currency symbols $ € £ ¥ ₹
  // - hyphen in numbers/dates (2026-08-12, 5-year)
  // - slash in dates (12/08/2026)
  // - colon in URLs/times
  // - period in decimals/URLs (preserved by not removing if adjacent to digits)
  // - @ and # for mentions/hashtags (preserved until metadata extraction)
  // - non-Latin characters (preserved for multilingual support)
  // \p{L} = Letters, \p{M} = Marks (diacritics, combining characters)
  result = result.replace(/[^\w\s'%$€£¥₹\-/.:@#\p{L}\p{M}]/gu, " ");

  // Normalize whitespace again
  result = normalizeWhitespace(result);

  return result;
}

/**
 * Step 9: Final canonicalization.
 * Ensures idempotency and determinism.
 */
function finalCanonicalize(text: string): string {
  // Final trim and whitespace collapse
  let result = text.trim().replace(/\s{2,}/g, " ").trim();
  // Remove trailing punctuation that doesn't carry semantic meaning
  // (period, exclamation, question mark at end)
  result = result.replace(/[.!?]+$/, "");
  return result.trim();
}

/**
 * Idempotency check: normalizing twice should equal normalizing once.
 */
export function isIdempotent(text: string, config?: NormalizationConfig): boolean {
  const once = normalizeClaim(text, config).normalizedText;
  const twice = normalizeClaim(once, config).normalizedText;
  return once === twice;
}
