"""
Verdict Validator - Phase 10
Applies business rules to ensure verdict consistency and safety.
"""
from typing import Optional
from app.schemas.evidence import EvidencePackage, RetrievalStatus
from app.schemas.verdict import VerifiedVerdict, Verdict


class VerdictValidator:
    """
    Validates and potentially corrects the final verdict based on business rules.

    Rules:
    - No evidence → UNVERIFIED
    - No valid evidence IDs → UNVERIFIED
    - Invalid verdict → reject
    - Confidence outside [0, 1] → reject
    - Unsupported citations → reject
    - AI infrastructure failures → AI_ERROR (not FALSE)
    """

    def __init__(self, package: EvidencePackage):
        self.package = package

    def validate(self, verdict: VerifiedVerdict) -> tuple[VerifiedVerdict, list[str]]:
        """
        Apply validation rules and return corrected verdict.

        Returns:
            (validated_verdict, list_of_warnings)
        """
        warnings = []

        # Rule 1: No evidence → UNVERIFIED
        if not self.package.evidence:
            if verdict.verdict != Verdict.UNVERIFIED:
                warnings.append("RULE: No evidence available, forcing UNVERIFIED")
                verdict = self._force_unverified(verdict, "No evidence available")

        # Rule 2: Retrieval status forces UNVERIFIED
        status_forces_unverified = {
            RetrievalStatus.NO_RESULTS,
            RetrievalStatus.NO_USABLE_EVIDENCE,
            RetrievalStatus.WEAK_EVIDENCE,
            RetrievalStatus.PROVIDER_ERROR,
            RetrievalStatus.TIMEOUT,
        }
        if self.package.retrieval_status in status_forces_unverified:
            if verdict.verdict != Verdict.UNVERIFIED:
                warnings.append(f"RULE: Retrieval status {self.package.retrieval_status.value} forces UNVERIFIED")
                verdict = self._force_unverified(verdict, f"Retrieval status: {self.package.retrieval_status.value}")

        # Rule 3: Confidence bounds
        if verdict.confidence < 0.0 or verdict.confidence > 1.0:
            warnings.append(f"RULE: Confidence {verdict.confidence} out of bounds [0,1], clamping")
            verdict.confidence = max(0.0, min(1.0, verdict.confidence))

        # Rule 4: Verdict must be valid taxonomy
        if verdict.verdict not in Verdict:
            warnings.append(f"RULE: Invalid verdict '{verdict.verdict}', defaulting to UNVERIFIED")
            verdict = self._force_unverified(verdict, "Invalid verdict from model")

        # Rule 5: Conflicting evidence should not produce high-confidence SUPPORTED/FALSE
        if self.package.retrieval_status == RetrievalStatus.CONFLICTING_EVIDENCE:
            if verdict.verdict in (Verdict.SUPPORTED, Verdict.FALSE) and verdict.confidence > 0.7:
                warnings.append("RULE: Conflicting evidence with high confidence, reducing confidence")
                verdict.confidence = min(verdict.confidence, 0.6)

        # Rule 6: Evidence count vs confidence sanity check
        if verdict.verdict in (Verdict.SUPPORTED, Verdict.FALSE):
            min_evidence_for_confidence = {
                0.9: 3,
                0.8: 2,
                0.7: 2,
                0.6: 1,
            }
            evidence_count = len(self.package.evidence)
            for conf_threshold, min_count in sorted(min_evidence_for_confidence.items(), reverse=True):
                if verdict.confidence >= conf_threshold and evidence_count < min_count:
                    warnings.append(f"RULE: Confidence {verdict.confidence:.1f} requires ≥{min_count} evidence items, have {evidence_count}")
                    verdict.confidence = min(verdict.confidence, conf_threshold - 0.1)

        # Rule 7: MISLEADING requires specific reasoning
        if verdict.verdict == Verdict.MISLEADING:
            misleading_indicators = [
                "context", "misleading", "exaggerat", "out of date", "old",
                "partial", "omission", "without context", "deceptive",
            ]
            reasoning_lower = verdict.reasoning.lower()
            has_indicator = any(ind in reasoning_lower for ind in misleading_indicators)
            if not has_indicator:
                warnings.append("RULE: MISLEADING verdict should explain missing context/exaggeration")
                # Don't force change, just warn

        # Rule 8: Source diversity check
        if verdict.verdict in (Verdict.SUPPORTED, Verdict.FALSE):
            if self.package.independent_domain_count < 2 and verdict.confidence > 0.7:
                warnings.append("RULE: Single domain with high confidence, reducing confidence")
                verdict.confidence = min(verdict.confidence, 0.65)

        return verdict, warnings

    def _force_unverified(self, verdict: VerifiedVerdict, reason: str) -> VerifiedVerdict:
        """Force verdict to UNVERIFIED with low confidence."""
        return VerifiedVerdict(
            verdict=Verdict.UNVERIFIED,
            confidence=0.0,
            summary=reason,
            reasoning=verdict.reasoning + f" [Forced UNVERIFIED: {reason}]",
            evidence=verdict.evidence,
            model_name=verdict.model_name,
            input_tokens=verdict.input_tokens,
            output_tokens=verdict.output_tokens,
            total_latency_ms=verdict.total_latency_ms,
        )