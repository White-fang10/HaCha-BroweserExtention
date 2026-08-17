"""
Grounding Validator - Phase 10
Validates that LLM output is grounded in the provided evidence.
Performs numeric consistency, entity consistency, negation, and temporal checks.
"""
import re
from typing import Optional
from app.schemas.evidence import EvidencePackage, EvidenceItem
from app.schemas.verdict import LLMVerdictResponse, EvidenceReference


class GroundingValidator:
    """
    Validates LLM output against evidence package.

    Checks:
    - Evidence ID validity
    - Numeric consistency
    - Entity consistency
    - Negation handling
    - Temporal context alignment
    - Unsupported claim detection
    """

    def __init__(self, package: EvidencePackage, context_evidence: list[EvidenceReference]):
        self.package = package
        self.context_evidence = {ref.id: ref for ref in context_evidence}
        self.all_excerpts = " ".join([ref.excerpt for ref in context_evidence])
        self.all_numbers = self._extract_numbers(self.all_excerpts)
        self.all_entities = self._extract_entities(self.all_excerpts)

    def validate(self, verdict: LLMVerdictResponse) -> tuple[bool, list[str]]:
        """
        Validate verdict against evidence.

        Returns:
            (is_valid, list_of_warnings)
        """
        warnings = []

        # 1. Validate evidence IDs exist
        id_warnings = self._validate_evidence_ids(verdict)
        warnings.extend(id_warnings)

        # 2. Check numeric consistency
        num_warnings = self._check_numeric_consistency(verdict)
        warnings.extend(num_warnings)

        # 3. Check entity consistency
        entity_warnings = self._check_entity_consistency(verdict)
        warnings.extend(entity_warnings)

        # 4. Check negation handling
        negation_warnings = self._check_negation(verdict)
        warnings.extend(negation_warnings)

        # 5. Check temporal alignment
        temporal_warnings = self._check_temporal_alignment(verdict)
        warnings.extend(temporal_warnings)

        # 6. Check for unsupported claims
        unsupported_warnings = self._check_unsupported_claims(verdict)
        warnings.extend(unsupported_warnings)

        # 7. Check evidence direction consistency
        direction_warnings = self._check_evidence_direction(verdict)
        warnings.extend(direction_warnings)

        is_valid = len([w for w in warnings if "ERROR" in w]) == 0

        return is_valid, warnings

    def _validate_evidence_ids(self, verdict: LLMVerdictResponse) -> list[str]:
        """Check all cited evidence IDs exist in context."""
        warnings = []
        valid_ids = set(self.context_evidence.keys())

        all_cited = (
            verdict.supporting_evidence +
            verdict.contradicting_evidence +
            verdict.contextual_evidence
        )

        for eid in all_cited:
            if eid not in valid_ids:
                warnings.append(f"ERROR: Cited evidence ID '{eid}' not found in context (valid: {sorted(valid_ids)})")

        return warnings

    def _extract_numbers(self, text: str) -> set[str]:
        """Extract numbers with context from text."""
        # Match percentages, decimals, integers with optional units
        pattern = r'\b(\d+(?:\.\d+)?%?|\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b'
        numbers = set(re.findall(pattern, text))
        return numbers

    def _extract_entities(self, text: str) -> set[str]:
        """Extract capitalized entities (organizations, people, places)."""
        # Simple extraction: capitalized words/phrases
        # In production, use NER (spaCy, etc.)
        words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', text)
        return set(words)

    def _check_numeric_consistency(self, verdict: LLMVerdictResponse) -> list[str]:
        """Check if numeric claims in reasoning match evidence."""
        warnings = []

        # Extract numbers from reasoning and summary
        reasoning_numbers = self._extract_numbers(verdict.reasoning + " " + verdict.summary)

        for num in reasoning_numbers:
            # Normalize (remove commas, handle percentages)
            normalized = num.replace(",", "")
            found = False
            for evidence_num in self.all_numbers:
                ev_normalized = evidence_num.replace(",", "")
                if normalized == ev_normalized:
                    found = True
                    break
                # Check if close (within 10% for relative comparison)
                try:
                    n_val = float(normalized.rstrip('%'))
                    e_val = float(ev_normalized.rstrip('%'))
                    if e_val != 0 and abs(n_val - e_val) / e_val < 0.1:
                        found = True
                        break
                except ValueError:
                    pass

            if not found and normalized not in ("0", "1", "100"):
                warnings.append(f"WARNING: Number '{num}' in reasoning not found in evidence")

        return warnings

    def _check_entity_consistency(self, verdict: LLMVerdictResponse) -> list[str]:
        """Check if entities in reasoning match evidence."""
        warnings = []

        reasoning_entities = self._extract_entities(verdict.reasoning + " " + verdict.summary)

        for entity in reasoning_entities:
            # Skip common words
            if entity.lower() in {"the", "this", "that", "which", "who", "what", "where", "when", "why", "how"}:
                continue

            # Check if entity or similar exists in evidence
            found = False
            for ev_entity in self.all_entities:
                if entity.lower() == ev_entity.lower():
                    found = True
                    break
                # Fuzzy match for similar entities
                if self._similar_entities(entity, ev_entity):
                    found = True
                    break

            if not found and len(entity) > 3:
                warnings.append(f"WARNING: Entity '{entity}' in reasoning not found in evidence")

        return warnings

    def _similar_entities(self, e1: str, e2: str) -> bool:
        """Simple entity similarity check."""
        if e1.lower() == e2.lower():
            return True
        # Check if one contains the other
        if e1.lower() in e2.lower() or e2.lower() in e1.lower():
            return True
        return False

    def _check_negation(self, verdict: LLMVerdictResponse) -> list[str]:
        """Check for potential negation misinterpretation."""
        warnings = []

        # Look for negation patterns in evidence
        negation_patterns = [
            r'\bnot\b', r'\bno\b', r'\bnever\b', r'\bneither\b', r'\bnor\b',
            r'\bdid not\b', r'\bdoes not\b', r'\bhas not\b', r'\bhave not\b',
            r'\bwithout\b', r'\babsence of\b', r'\black of\b',
        ]

        # Check if evidence has negations but reasoning doesn't reflect them
        for ref in self.context_evidence.values():
            excerpt_lower = ref.excerpt.lower()
            has_negation = any(re.search(p, excerpt_lower) for p in negation_patterns)

            if has_negation:
                # Check if reasoning mentions the negated claim
                reasoning_lower = verdict.reasoning.lower()
                # This is a heuristic - in production use more sophisticated NLP
                if "not" not in reasoning_lower and "no" not in reasoning_lower:
                    warnings.append(f"WARNING: Evidence {ref.id} contains negation but reasoning may not reflect it")

        return warnings

    def _check_temporal_alignment(self, verdict: LLMVerdictResponse) -> list[str]:
        """Check temporal consistency between claim, evidence, and reasoning."""
        warnings = []

        # Extract years from evidence
        evidence_years = set(re.findall(r'\b(19|20)\d{2}\b', self.all_excerpts))

        # Extract years from reasoning
        reasoning_years = set(re.findall(r'\b(19|20)\d{2}\b', verdict.reasoning + " " + verdict.summary))

        # Check if reasoning mentions years not in evidence
        for year in reasoning_years:
            if year not in evidence_years:
                warnings.append(f"WARNING: Year '{year}' mentioned in reasoning but not found in evidence")

        # Check for "current" / "now" claims with old evidence
        reasoning_lower = (verdict.reasoning + " " + verdict.summary).lower()
        current_indicators = ["currently", "now", "today", "present", "as of now"]
        if any(ind in reasoning_lower for ind in current_indicators):
            # Check if evidence is recent (within 2 years)
            # This would need actual dates from evidence
            pass

        return warnings

    def _check_unsupported_claims(self, verdict: LLMVerdictResponse) -> list[str]:
        """Detect claims in reasoning not supported by evidence."""
        warnings = []

        # Split reasoning into sentences
        sentences = re.split(r'[.!?]+', verdict.reasoning)

        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 20:  # Skip short fragments
                continue

            # Check if sentence makes factual claims
            factual_indicators = [
                "study found", "research shows", "data indicates", "report states",
                "according to", "proves", "demonstrates", "confirms", "establishes",
                "percent", "percentage", "majority", "most", "all", "none",
            ]

            is_factual = any(ind in sentence.lower() for ind in factual_indicators)

            if is_factual:
                # Check if this sentence's key claims are in evidence
                sent_numbers = self._extract_numbers(sentence)
                sent_entities = self._extract_entities(sentence)

                has_support = False
                for num in sent_numbers:
                    if num in self.all_numbers:
                        has_support = True
                        break

                for entity in sent_entities:
                    if entity in self.all_entities:
                        has_support = True
                        break

                if not has_support and sent_numbers:
                    warnings.append(f"WARNING: Potentially unsupported factual claim in reasoning: {sentence[:100]}...")

        return warnings

    def _check_evidence_direction(self, verdict: LLMVerdictResponse) -> list[str]:
        """Check if evidence direction matches Phase 9 classification."""
        warnings = []

        # Build map of evidence ID -> direction from package
        package_directions = {}
        for i, item in enumerate(self.package.evidence):
            package_directions[f"E{i+1}"] = item.direction.value

        # Check supporting evidence
        for eid in verdict.supporting_evidence:
            if eid in package_directions:
                pkg_dir = package_directions[eid]
                if pkg_dir == "CONTRADICTS":
                    warnings.append(f"WARNING: Evidence {eid} classified as CONTRADICTS but cited as SUPPORTS")

        # Check contradicting evidence
        for eid in verdict.contradicting_evidence:
            if eid in package_directions:
                pkg_dir = package_directions[eid]
                if pkg_dir == "SUPPORTS":
                    warnings.append(f"WARNING: Evidence {eid} classified as SUPPORTS but cited as CONTRADICTS")

        return warnings