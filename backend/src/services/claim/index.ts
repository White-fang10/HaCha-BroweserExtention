/**
 * Claim Services - Public API
 * Re-exports all claim processing functions for external use
 */

export { normalizeClaim, normalizeWhitespace } from "./claim-normalizer.js";
export { createClaimIdentity, hashClaim, createCacheKey as createClaimCacheKey } from "./claim-hasher.js";
export { extractMetadata, extractHashtags, extractMentions, extractUrls, extractNumbers, extractDates, extractPercentages, extractUnits, extractCurrency, extractEntities, extractNegation, removeMetadataFromText } from "./metadata-extractor.js";
export type { ClaimMetadata, NormalizedClaim, NormalizationConfig } from "../../types/claim.js";