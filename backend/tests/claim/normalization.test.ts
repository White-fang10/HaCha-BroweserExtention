/**
 * Normalization Tests - Phase 5
 * Tests for claim normalization pipeline
 */

import { describe, it, expect } from "vitest";
import { normalizeClaim } from "../../src/services/claim/claim-normalizer.js";
import { isIdempotent } from "../../src/services/claim/claim-normalizer.js";
import { DEFAULT_NORMALIZATION_CONFIG } from "../../src/types/claim.js";

describe("Claim Normalization Pipeline", () => {
  describe("Whitespace Normalization", () => {
    it("should collapse multiple spaces", () => {
      const result = normalizeClaim("NASA    confirms     Earth");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });

    it("should handle newlines and tabs", () => {
      const result = normalizeClaim("NASA\nconfirms\tEarth");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });

    it("should trim leading/trailing whitespace", () => {
      const result = normalizeClaim("   NASA confirms Earth   ");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });

    it("should handle unicode spaces", () => {
      const result = normalizeClaim("NASA\u{2000}confirms\u{2001}Earth");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });
  });

  describe("Case Normalization", () => {
    it("should lowercase all text", () => {
      const result = normalizeClaim("NASA CONFIRMS EARTH");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });

    it("should handle mixed case", () => {
      const result = normalizeClaim("Nasa Confirms Earth");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });

    it("should produce same hash for case variations", async () => {
      const resultA = normalizeClaim("NASA CONFIRMS EARTH");
      const resultB = normalizeClaim("nasa confirms earth");
      const resultC = normalizeClaim("Nasa Confirms Earth");
      expect(resultA.normalizedText).toBe(resultB.normalizedText);
      expect(resultB.normalizedText).toBe(resultC.normalizedText);
    });
  });

  describe("Unicode Normalization", () => {
    it("should normalize composed characters", () => {
      // é as single char vs e + combining acute
      const composed = "café";
      const decomposed = "cafe\u{0301}";
      const resultA = normalizeClaim(composed);
      const resultB = normalizeClaim(decomposed);
      expect(resultA.normalizedText).toBe(resultB.normalizedText);
    });

    it("should handle fullwidth characters", () => {
      const result = normalizeClaim("ＮＡＳＡ");
      expect(result.normalizedText).toBe("nasa");
    });
  });

  describe("Punctuation Normalization", () => {
    it("should remove decorative repeated punctuation", () => {
      const result = normalizeClaim("NASA confirms Earth!!!");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });

    it("should remove multiple question marks", () => {
      const result = normalizeClaim("Is Earth flat???");
      expect(result.normalizedText).toBe("is earth flat");
    });

    it("should remove ellipsis", () => {
      const result = normalizeClaim("Earth is round....");
      expect(result.normalizedText).toBe("earth is round");
    });

    it("should preserve apostrophes in contractions", () => {
      const result = normalizeClaim("Earth isn't flat");
      expect(result.normalizedText).toBe("earth isn't flat");
    });

    it("should preserve apostrophes in possessives", () => {
      const result = normalizeClaim("NASA's discovery");
      expect(result.normalizedText).toBe("nasa's discovery");
    });
  });

  describe("OCR Artifact Cleanup", () => {
    it("should fix spaced-out all-caps acronyms", () => {
      const result = normalizeClaim("N A S A confirms Earth");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });

    it("should fix E S A", () => {
      const result = normalizeClaim("E S A confirms Earth");
      expect(result.normalizedText).toBe("esa confirms earth");
    });

    it("should not collapse normal words", () => {
      const result = normalizeClaim("Earth is round");
      expect(result.normalizedText).toBe("earth is round");
    });

    it("should remove decorative emoji", () => {
      const result = normalizeClaim("NASA 🚀 confirms Earth 🌍");
      expect(result.normalizedText).toBe("nasa confirms earth");
      expect(result.warnings).toContain("Decorative emoji removed from canonical claim");
    });
  });

  describe("Metadata Extraction", () => {
    it("should extract hashtags", () => {
      const result = normalizeClaim("NASA confirms Earth #NASA #Breaking");
      expect(result.metadata.hashtags).toContain("NASA");
      expect(result.metadata.hashtags).toContain("Breaking");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });

    it("should extract mentions", () => {
      const result = normalizeClaim("@NASA confirms Earth @news");
      expect(result.metadata.mentions).toContain("NASA");
      expect(result.metadata.mentions).toContain("news");
      expect(result.normalizedText).toBe("confirms earth");
    });

    it("should extract URLs", () => {
      const result = normalizeClaim("See https://example.com for proof");
      expect(result.metadata.urls).toContain("https://example.com");
      expect(result.normalizedText).toBe("see for proof");
    });

    it("should extract www URLs", () => {
      const result = normalizeClaim("Check www.nasa.gov");
      expect(result.metadata.urls).toContain("www.nasa.gov");
      expect(result.normalizedText).toBe("check");
    });
  });

  describe("Number/Preservation", () => {
    it("should preserve numbers", () => {
      const result = normalizeClaim("Population is 8 billion");
      expect(result.normalizedText).toBe("population is 8 billion");
      expect(result.metadata.numbers).toContain("8");
    });

    it("should preserve decimals", () => {
      const result = normalizeClaim("Rate is 3.14 percent");
      expect(result.normalizedText).toBe("rate is 3.14 percent");
      expect(result.metadata.numbers).toContain("3.14");
    });

    it("should preserve percentages", () => {
      const result = normalizeClaim("Effectiveness is 95%");
      expect(result.normalizedText).toBe("effectiveness is 95%");
      expect(result.metadata.percentages).toContain("95%");
    });

    it("should preserve 'percent' word", () => {
      const result = normalizeClaim("Effectiveness is 95 percent");
      expect(result.normalizedText).toBe("effectiveness is 95 percent");
      expect(result.metadata.percentages).toContain("95 percent");
    });

    it("should preserve units", () => {
      const result = normalizeClaim("Distance is 5 km");
      expect(result.normalizedText).toBe("distance is 5 km");
      expect(result.metadata.units).toContain("5 km");
    });

    it("should preserve currency", () => {
      const result = normalizeClaim("Cost is $100");
      expect(result.normalizedText).toBe("cost is $100");
      expect(result.metadata.currency).toContain("$100");
    });

    it("should preserve dates", () => {
      const result = normalizeClaim("Event on 2026-08-12");
      expect(result.normalizedText).toBe("event on 2026-08-12");
      expect(result.metadata.dates).toContain("2026-08-12");
    });

    it("should warn on ambiguous date format", () => {
      const result = normalizeClaim("Event on 12/08/2026");
      expect(result.warnings).toContain("Ambiguous date format detected (locale-dependent)");
    });
  });

  describe("Negation Preservation", () => {
    it("should preserve 'not'", () => {
      const result = normalizeClaim("Earth is not flat");
      expect(result.normalizedText).toBe("earth is not flat");
      expect(result.metadata.negation).toContain("not");
    });

    it("should preserve 'never'", () => {
      const result = normalizeClaim("NASA never said that");
      expect(result.normalizedText).toBe("nasa never said that");
      expect(result.metadata.negation).toContain("never");
    });

    it("should preserve contractions with not", () => {
      const result = normalizeClaim("Earth isn't flat");
      expect(result.normalizedText).toBe("earth isn't flat");
      expect(result.metadata.negation).toContain("isn't");
    });

    it("should preserve 'without'", () => {
      const result = normalizeClaim("Earth without water");
      expect(result.normalizedText).toBe("earth without water");
      expect(result.metadata.negation).toContain("without");
    });
  });

  describe("Entities Preservation", () => {
    it("should preserve known entities", () => {
      const result = normalizeClaim("NASA confirms Earth discovery");
      expect(result.normalizedText).toBe("nasa confirms earth discovery");
      expect(result.metadata.entities).toContain("NASA");
    });

    it("should preserve organization acronyms", () => {
      const result = normalizeClaim("WHO and UN agree");
      expect(result.normalizedText).toBe("who and un agree");
      expect(result.metadata.entities).toContain("WHO");
      expect(result.metadata.entities).toContain("UN");
    });
  });

  describe("Idempotency", () => {
    it("should be idempotent for basic text", () => {
      const text = "NASA confirms Earth will experience three days of darkness";
      expect(isIdempotent(text)).toBe(true);
    });

    it("should be idempotent for text with punctuation", () => {
      const text = "NASA CONFIRMS Earth!!!";
      expect(isIdempotent(text)).toBe(true);
    });

    it("should be idempotent for text with metadata", () => {
      const text = "NASA confirms Earth #NASA @news https://example.com";
      expect(isIdempotent(text)).toBe(true);
    });

    it("should be idempotent for text with OCR artifacts", () => {
      const text = "N A S A confirms Earth";
      expect(isIdempotent(text)).toBe(true);
    });
  });

  describe("Different Claims Produce Different Output", () => {
    it("should differentiate 20% vs 30%", () => {
      const resultA = normalizeClaim("Vaccine is 20% effective");
      const resultB = normalizeClaim("Vaccine is 30% effective");
      expect(resultA.normalizedText).not.toBe(resultB.normalizedText);
    });

    it("should differentiate three vs five days", () => {
      const resultA = normalizeClaim("three days of darkness");
      const resultB = normalizeClaim("five days of darkness");
      expect(resultA.normalizedText).not.toBe(resultB.normalizedText);
    });

    it("should differentiate NASA vs ESA", () => {
      const resultA = normalizeClaim("NASA confirms discovery");
      const resultB = normalizeClaim("ESA confirms discovery");
      expect(resultA.normalizedText).not.toBe(resultB.normalizedText);
    });

    it("should differentiate with vs without negation", () => {
      const resultA = normalizeClaim("Earth is flat");
      const resultB = normalizeClaim("Earth is not flat");
      expect(resultA.normalizedText).not.toBe(resultB.normalizedText);
    });
  });

  describe("Canonicalization Examples from Spec", () => {
    it("should normalize NASA CONFIRMS Earth!!! to canonical form", () => {
      const result = normalizeClaim("NASA CONFIRMS Earth will experience three days of darkness!!!");
      expect(result.normalizedText).toBe("nasa confirms earth will experience three days of darkness");
    });

    it("should normalize nasa confirms earth... to canonical form", () => {
      const result = normalizeClaim("nasa confirms earth will experience three days of darkness");
      expect(result.normalizedText).toBe("nasa confirms earth will experience three days of darkness");
    });

    it("should normalize multiline to canonical form", () => {
      const result = normalizeClaim("NASA confirms Earth will experience\nthree days of darkness.");
      expect(result.normalizedText).toBe("nasa confirms earth will experience three days of darkness");
    });
  });

  describe("Multilingual Support", () => {
    it("should not corrupt Tamil", () => {
      const result = normalizeClaim("தமிழ்");
      expect(result.normalizedText).toBe("தமிழ்");
    });

    it("should not corrupt Malayalam", () => {
      const result = normalizeClaim("മലയാളം");
      expect(result.normalizedText).toBe("മലയാളം");
    });

    it("should not corrupt Hindi", () => {
      const result = normalizeClaim("हिन्दी");
      expect(result.normalizedText).toBe("हिन्दी");
    });

    it("should not corrupt Arabic", () => {
      const result = normalizeClaim("العربية");
      expect(result.normalizedText).toBe("العربية");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string", () => {
      const result = normalizeClaim("");
      expect(result.normalizedText).toBe("");
    });

    it("should handle only whitespace", () => {
      const result = normalizeClaim("   \n\t  ");
      expect(result.normalizedText).toBe("");
    });

    it("should handle very long text", () => {
      const longText = "a ".repeat(10000);
      const result = normalizeClaim(longText, { ...DEFAULT_NORMALIZATION_CONFIG, maxLength: 100 });
      expect(result.normalizedText.length).toBeLessThanOrEqual(100);
      expect(result.warnings).toContain("Input exceeds maximum length, truncated");
    });

    it("should handle control characters", () => {
      const result = normalizeClaim("NASA\u{0000}confirms\u{001F}Earth");
      expect(result.normalizedText).toBe("nasa confirms earth");
    });
  });
});