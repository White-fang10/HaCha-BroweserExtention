/**
 * Fact-Check Mapper Tests - Phase 7
 */

import { describe, it, expect, vi } from "vitest";
import { mapFactCheckToVerdict, createVerificationSources, generateExplanation } from "../../src/services/factcheck/factcheck.mapper.js";
import { ExternalFactCheck, MatchType } from "../../src/types/factcheck.js";
import { Verdict } from "../../src/types/api.js";

describe("mapFactCheckToVerdict", () => {
  const createExternalFactCheck = (textualRating: string, overrides: Partial<ExternalFactCheck> = {}): ExternalFactCheck => ({
    claimText: "COVID vaccines cause infertility",
    publisher: { name: "Reuters Fact Check", site: "reuters.com" },
    review: {
      title: "Fact check on vaccine infertility claim",
      url: "https://reuters.com/factcheck/vaccine-infertility",
      reviewDate: "2021-03-20",
      textualRating,
      ...overrides.review,
    },
    ...overrides,
  });

  const mockMatchScore = {
    textSimilarity: 0.95,
    entityAgreement: 1.0,
    numberAgreement: 1.0,
    dateAgreement: 1.0,
    negationAgreement: 1.0,
  };

  // SUPPORTED ratings
  it("should map 'True' to SUPPORTED", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("True"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("SUPPORTED");
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("should map 'Correct' to SUPPORTED", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Correct"),
      "HIGH_CONFIDENCE",
      0.9,
      mockMatchScore
    );
    expect(result.verdict).toBe("SUPPORTED");
  });

  it("should map 'Accurate' to SUPPORTED", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Accurate"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("SUPPORTED");
  });

  it("should map 'Verified' to SUPPORTED", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Verified"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("SUPPORTED");
  });

  it("should map 'Geppetto Checkmark' to SUPPORTED", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Geppetto Checkmark"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("SUPPORTED");
  });

  // FALSE ratings
  it("should map 'False' to FALSE", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("False"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("FALSE");
  });

  it("should map 'Incorrect' to FALSE", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Incorrect"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("FALSE");
  });

  it("should map 'Pants on Fire' to FALSE", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Pants on Fire"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("FALSE");
  });

  it("should map 'Four Pinocchios' to FALSE", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Four Pinocchios"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("FALSE");
  });

  // MISLEADING ratings
  it("should map 'Misleading' to MISLEADING", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Misleading"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("MISLEADING");
  });

  it("should map 'Half True' to MISLEADING", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Half True"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("MISLEADING");
  });

  it("should map 'Mostly True' to MISLEADING", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Mostly True"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("MISLEADING");
  });

  it("should map 'Missing Context' to MISLEADING", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Missing Context"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("MISLEADING");
  });

  it("should map 'Three Pinocchios' to MISLEADING", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Three Pinocchios"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("MISLEADING");
  });

  // UNVERIFIED ratings
  it("should map 'Unverified' to UNVERIFIED", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Unverified"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("UNVERIFIED");
  });

  it("should map 'Unproven' to UNVERIFIED", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Unproven"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("UNVERIFIED");
  });

  it("should map 'Opinion' to UNVERIFIED", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Opinion"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("UNVERIFIED");
  });

  it("should map 'Satire' to UNVERIFIED", () => {
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("Satire"),
      "EXACT",
      1.0,
      mockMatchScore
    );
    expect(result.verdict).toBe("UNVERIFIED");
  });

  // Confidence adjustments
  it("should boost confidence for EXACT match", () => {
    const exactResult = mapFactCheckToVerdict(
      createExternalFactCheck("True"),
      "EXACT",
      1.0,
      mockMatchScore
    );

    const highConfResult = mapFactCheckToVerdict(
      createExternalFactCheck("True"),
      "HIGH_CONFIDENCE",
      0.9,
      mockMatchScore
    );

    expect(exactResult.confidence).toBeGreaterThan(highConfResult.confidence);
  });

  it("should penalize confidence for LOW_CONFIDENCE match", () => {
    const highConfResult = mapFactCheckToVerdict(
      createExternalFactCheck("True"),
      "HIGH_CONFIDENCE",
      0.9,
      mockMatchScore
    );

    const lowConfResult = mapFactCheckToVerdict(
      createExternalFactCheck("True"),
      "LOW_CONFIDENCE",
      0.7,
      mockMatchScore
    );

    expect(highConfResult.confidence).toBeGreaterThan(lowConfResult.confidence);
  });

  // Safeguards
  it("should force UNVERIFIED when negation disagrees", () => {
    const badMatchScore = { ...mockMatchScore, negationAgreement: 0 };
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("True"),
      "EXACT",
      1.0,
      badMatchScore
    );
    expect(result.verdict).toBe("UNVERIFIED");
    expect(result.confidence).toBe(0.1);
  });

  it("should force UNVERIFIED when numbers disagree", () => {
    const badMatchScore = { ...mockMatchScore, numberAgreement: 0 };
    const result = mapFactCheckToVerdict(
      createExternalFactCheck("True"),
      "EXACT",
      1.0,
      badMatchScore
    );
    expect(result.verdict).toBe("UNVERIFIED");
    expect(result.confidence).toBe(0.1);
  });
});

describe("createVerificationSources", () => {
  it("should create properly formatted VerificationSource", () => {
    const factCheck: ExternalFactCheck = {
      claimText: "Test claim",
      publisher: { name: "Test Publisher", site: "test.com" },
      review: {
        title: "Test Title",
        url: "https://test.com/factcheck",
        reviewDate: "2023-01-01",
        textualRating: "True",
      },
    };

    const sources = createVerificationSources(factCheck, "EXACT", "SUPPORTED");

    expect(sources).toHaveLength(1);
    expect(sources[0].title).toBe("Test Title");
    expect(sources[0].url).toBe("https://test.com/factcheck");
    expect(sources[0].publisher).toBe("Test Publisher");
    expect(sources[0].publishDate).toBe("2023-01-01");
    expect(sources[0].reliabilityScore).toBe(0.95);
  });

  it("should use claimant as title if review title missing", () => {
    const factCheck: ExternalFactCheck = {
      claimText: "Test claim",
      claimant: "Test Claimant",
      publisher: { name: "Test Publisher", site: "test.com" },
      review: {
        url: "https://test.com/factcheck",
        reviewDate: "2023-01-01",
        textualRating: "True",
      },
    };

    const sources = createVerificationSources(factCheck, "EXACT", "SUPPORTED");

    expect(sources[0].title).toBe("Test Claimant");
  });

  it("should adjust reliability score based on match type", () => {
    const factCheck: ExternalFactCheck = {
      claimText: "Test claim",
      publisher: { name: "Test Publisher", site: "test.com" },
      review: {
        title: "Test",
        url: "https://test.com",
        reviewDate: "2023-01-01",
        textualRating: "True",
      },
    };

    const exactSources = createVerificationSources(factCheck, "EXACT", "SUPPORTED");
    const highSources = createVerificationSources(factCheck, "HIGH_CONFIDENCE", "SUPPORTED");
    const lowSources = createVerificationSources(factCheck, "LOW_CONFIDENCE", "SUPPORTED");

    expect(exactSources[0].reliabilityScore).toBe(0.95);
    expect(highSources[0].reliabilityScore).toBe(0.85);
    expect(lowSources[0].reliabilityScore).toBe(0.7);
  });
});

describe("generateExplanation", () => {
  it("should generate human-readable explanation", () => {
    const factCheck: ExternalFactCheck = {
      claimText: "COVID vaccines cause infertility",
      publisher: { name: "Reuters Fact Check", site: "reuters.com" },
      review: {
        title: "Fact check on vaccine infertility",
        url: "https://reuters.com/factcheck",
        reviewDate: "2023-01-01",
        textualRating: "False",
      },
    };

    const explanation = generateExplanation(factCheck, "EXACT", "FALSE", 0.98);

    expect(explanation).toContain("exactly matches");
    expect(explanation).toContain("Reuters Fact Check");
    expect(explanation).toContain("False");
    expect(explanation).toContain("FALSE");
    expect(explanation).toContain("98.0%");
    expect(explanation).toContain("COVID vaccines cause infertility");
  });

  it("should handle different match types", () => {
    const factCheck: ExternalFactCheck = {
      claimText: "Test claim",
      publisher: { name: "Publisher" },
      review: {
        title: "Title",
        url: "https://test.com",
        reviewDate: "2023-01-01",
        textualRating: "True",
      },
    };

    expect(generateExplanation(factCheck, "EXACT", "SUPPORTED", 1.0)).toContain("exactly matches");
    expect(generateExplanation(factCheck, "HIGH_CONFIDENCE", "SUPPORTED", 0.9)).toContain("closely matches");
    expect(generateExplanation(factCheck, "LOW_CONFIDENCE", "SUPPORTED", 0.7)).toContain("partially matches");
  });
});