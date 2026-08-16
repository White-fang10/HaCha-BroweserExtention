/**
 * Normalization Rules - Phase 5
 *
 * Conservative, deterministic rules for claim normalization.
 * These rules prioritize precision of identity over semantic similarity.
 */

/**
 * Negation words that must be preserved - removing these changes meaning.
 */
export const NEGATION_WORDS = new Set([
  "not",
  "no",
  "never",
  "without",
  "false",
  "fake",
  "denies",
  "denied",
  "denying",
  "cannot",
  "cant",
  "isn't",
  "isnt",
  "aren't",
  "arent",
  "wasn't",
  "wasnt",
  "weren't",
  "werent",
  "don't",
  "dont",
  "doesn't",
  "doesnt",
  "didn't",
  "didnt",
  "won't",
  "wont",
  "wouldn't",
  "wouldnt",
  "shouldn't",
  "shouldnt",
  "couldn't",
  "couldnt",
  "ain't",
  "aint",
  "none",
  "nobody",
  "nothing",
  "nowhere",
  "neither",
  "nor",
  "barely",
  "hardly",
  "scarcely",
  "rarely",
  "seldom",
]);

/**
 * Common OCR character confusion pairs (conservative - only applied in specific contexts).
 * We do NOT globally replace these because legitimate words contain these characters.
 */
export const OCR_CONFUSION_PAIRS: Array<[string, string]> = [
  // Only applied within numeric contexts where appropriate
  ["O", "0"],
  ["I", "1"],
  ["S", "5"],
  ["B", "8"],
];

/**
 * Decorative punctuation patterns that can be safely reduced.
 * Repeated punctuation: !!! -> !, ??? -> ?, ... -> .
 */
export const DECORATIVE_PUNCTUATION_PATTERNS: Array<[RegExp, string]> = [
  [/[!]{2,}/g, ""],           // Multiple exclamation marks removed
  [/\?{2,}/g, ""],            // Multiple question marks removed
  [/\.{3,}/g, ""],            // Multiple periods (ellipsis) removed
  [/[*]{2,}/g, ""],           // Multiple asterisks removed
  [/[~]{2,}/g, ""],           // Multiple tildes removed
];

/**
 * Whitespace characters to normalize (including unicode spaces).
 * Includes: space, tab, newline, vertical tab, form feed, carriage return,
 * and various unicode spaces (U+00A0, U+1680, U+2000-U+200A, U+2028, U+2029,
 * U+202F, U+205F, U+3000).
 * Using String.fromCharCode to avoid literal unicode in regex.
 */
const UNICODE_SPACES =
  " " +  // NBSP
  " " +  // OGHAM SPACE MARK
  " " + " " + " " + " " + " " + " " + " " + " " + " " + " " + " " +  // EN QUAD through HAIR SPACE
  " " + " " +  // LINE SEPARATOR, PARAGRAPH SEPARATOR
  " " +  // NARROW NO-BREAK SPACE
  " " +  // MEDIUM MATHEMATICAL SPACE
  "　";   // IDEOGRAPHIC SPACE

export const WHITESPACE_REGEX = new RegExp("[\\s" + UNICODE_SPACES + "]+", "g");

/**
 * Control characters to strip (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F).
 * Using hex escapes to avoid literal control characters in source.
 */
export const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Emoji/decorative symbol ranges to remove from canonical claim.
 * This is conservative - only removes common decorative emoji.
 */
export const EMOJI_REGEX = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;

/**
 * Number pattern - integers, decimals, with optional thousand separators.
 */
export const NUMBER_REGEX = /\b\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?\b|\b\d+\.\d+\b|\b\d+\b/g;

/**
 * Percentage pattern.
 */
export const PERCENTAGE_REGEX = /\b\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?\s?percent\b|\b\d+(?:\.\d+)?\s?percentage\s?points\b/gi;

/**
 * Currency pattern - symbols and codes.
 */
export const CURRENCY_REGEX = /[$€£¥₹]\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|\b(?:USD|EUR|GBP|INR|JPY|CNY)\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?/gi;

/**
 * Unit pattern - number followed by common units.
 */
export const UNIT_REGEX = /\b\d+(?:\.\d+)?\s?(?:km|cm|mm|m|mi|ft|in|kg|g|lb|lbs|mg|°c|°f|degrees?|mph|kmh|hours?|minutes?|seconds?|days?|weeks?|months?|years?)\b/gi;

/**
 * Date pattern - multiple formats.
 */
export const DATE_REGEX = /\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/gi;

/**
 * URL pattern.
 */
export const URL_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

/**
 * Hashtag pattern.
 */
export const HASHTAG_REGEX = /#([a-z0-9_]+)/gi;

/**
 * Mention pattern.
 */
export const MENTION_REGEX = /@([a-z0-9_]+)/gi;

/**
 * Named entities - uppercase acronyms and known organizations (conservative).
 */
export const ENTITY_REGEX = /\b[A-Z][A-Z0-9]{2,}\b|\b(?:NASA|WHO|UN|EU|US|UK|EU|ESA|OpenAI|Google|Apple|Microsoft|COVID-19|COVID|India|China|Russia|America)\b/g;

/**
 * OCR spaced-letter pattern - "N A S A" -> "NASA".
 * Applied conservatively only to all-caps spaced sequences.
 */
export const OCR_SPACED_LETTERS_REGEX = /\b([A-Z])(?:\s([A-Z])){1,}\b/g;