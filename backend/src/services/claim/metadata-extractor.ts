/**
 * Metadata Extractor - Phase 5
 *
 * Extracts structured metadata from claims without altering canonical text.
 * This preserves information for later phases (Phase 6+).
 */

import {
  URL_REGEX,
  HASHTAG_REGEX,
  MENTION_REGEX,
  NUMBER_REGEX,
  PERCENTAGE_REGEX,
  CURRENCY_REGEX,
  UNIT_REGEX,
  DATE_REGEX,
  ENTITY_REGEX,
  NEGATION_WORDS,
} from "./normalization-rules.js";
import { ClaimMetadata } from "../../types/claim.js";

/**
 * Extract all metadata from a claim.
 * @param text - Raw claim text
 * @returns Structured metadata
 */
export function extractMetadata(text: string): ClaimMetadata {
  const hashtags = extractHashtags(text);
  const mentions = extractMentions(text);
  const urls = extractUrls(text);
  const numbers = extractNumbers(text);
  const dates = extractDates(text);
  const percentages = extractPercentages(text);
  const units = extractUnits(text);
  const currency = extractCurrency(text);
  const entities = extractEntities(text);
  const negation = extractNegation(text);

  return {
    hashtags,
    mentions,
    urls,
    numbers,
    dates,
    percentages,
    units,
    currency,
    entities,
    negation,
  };
}

/**
 * Extract hashtags (without #).
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(HASHTAG_REGEX);
  if (!matches) return [];
  return matches.map(m => m.substring(1));
}

/**
 * Extract mentions (without @).
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(MENTION_REGEX);
  if (!matches) return [];
  return matches.map(m => m.substring(1));
}

/**
 * Extract URLs.
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

/**
 * Extract numbers (as strings).
 */
export function extractNumbers(text: string): string[] {
  const matches = text.match(NUMBER_REGEX);
  return matches || [];
}

/**
 * Extract dates.
 */
export function extractDates(text: string): string[] {
  const matches = text.match(DATE_REGEX);
  return matches || [];
}

/**
 * Extract percentages.
 */
export function extractPercentages(text: string): string[] {
  const matches = text.match(PERCENTAGE_REGEX);
  return matches || [];
}

/**
 * Extract units (number + unit).
 */
export function extractUnits(text: string): string[] {
  const matches = text.match(UNIT_REGEX);
  return matches || [];
}

/**
 * Extract currency values.
 */
export function extractCurrency(text: string): string[] {
  const matches = text.match(CURRENCY_REGEX);
  return matches || [];
}

/**
 * Extract named entities.
 */
export function extractEntities(text: string): string[] {
  const matches = text.match(ENTITY_REGEX);
  return matches || [];
}

/**
 * Extract negation words.
 */
export function extractNegation(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  return words.filter(w => NEGATION_WORDS.has(w.replace(/[^\w]/g, "")));
}

/**
 * Remove metadata from text for canonical representation.
 * Hashtags, mentions, URLs are excluded from canonical claim.
 */
export function removeMetadataFromText(
  text: string,
  config: { extractHashtags: boolean; extractMentions: boolean; extractUrls: boolean }
): string {
  let result = text;

  if (config.extractUrls) {
    result = result.replace(URL_REGEX, " ");
  }

  if (config.extractHashtags) {
    result = result.replace(HASHTAG_REGEX, " ");
  }

  if (config.extractMentions) {
    result = result.replace(MENTION_REGEX, " ");
  }

  return result;
}
