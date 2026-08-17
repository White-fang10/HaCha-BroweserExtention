"""
Query Generation - Phase 9
Generate effective search queries from claims and claim analysis.
"""
from typing import Optional
from app.schemas.evidence import ClaimAnalysis


class QueryGenerator:
    """Generate search queries from claims and analysis."""

    def __init__(
        self,
        max_queries: int = 5,
        include_direct: bool = True,
        include_entity_predicate: bool = True,
        include_evidence: bool = True,
        include_study: bool = True,
        include_factcheck: bool = True
    ):
        self.max_queries = max_queries
        self.include_direct = include_direct
        self.include_entity_predicate = include_entity_predicate
        self.include_evidence = include_evidence
        self.include_study = include_study
        self.include_factcheck = include_factcheck

    def generate(self, claim: str, analysis: Optional[ClaimAnalysis] = None) -> list[str]:
        """Generate a bounded set of search queries."""
        queries = []

        # 1. Direct query (the claim itself, possibly trimmed)
        if self.include_direct:
            direct = self._generate_direct_query(claim)
            if direct:
                queries.append(direct)

        # 2. Entity + Predicate query
        if self.include_entity_predicate and analysis:
            ep_query = self._generate_entity_predicate_query(claim, analysis)
            if ep_query:
                queries.append(ep_query)

        # 3. Claim + Evidence query
        if self.include_evidence:
            ev_query = self._generate_evidence_query(claim, analysis)
            if ev_query:
                queries.append(ev_query)

        # 4. Claim + Study query
        if self.include_study:
            study_query = self._generate_study_query(claim, analysis)
            if study_query:
                queries.append(study_query)

        # 5. Claim + Fact-check query
        if self.include_factcheck:
            fc_query = self._generate_factcheck_query(claim, analysis)
            if fc_query:
                queries.append(fc_query)

        # Deduplicate and limit
        unique_queries = []
        seen = set()
        for q in queries:
            q_lower = q.lower()
            if q_lower not in seen:
                seen.add(q_lower)
                unique_queries.append(q)

        return unique_queries[:self.max_queries]

    def _generate_direct_query(self, claim: str) -> str:
        """Generate direct query from claim."""
        # Trim to reasonable length, remove trailing punctuation
        query = claim.strip().rstrip('.!?')
        if len(query) > 200:
            # Try to cut at a word boundary
            query = query[:197] + "..."
        return query

    def _generate_entity_predicate_query(self, claim: str, analysis: Optional[ClaimAnalysis]) -> Optional[str]:
        """Generate entity + predicate query."""
        parts = []

        if analysis:
            # Add key entities
            if analysis.entities:
                parts.extend(analysis.entities[:3])
            if analysis.organizations:
                parts.extend(analysis.organizations[:2])
            if analysis.people:
                parts.extend(analysis.people[:2])

            # Add main predicate
            if analysis.main_predicate:
                parts.append(analysis.main_predicate)

            # Add claim subject/object
            if analysis.claim_subject:
                parts.append(analysis.claim_subject)
            if analysis.claim_object:
                parts.append(analysis.claim_object)

        if not parts:
            # Fallback: extract key nouns from claim
            words = claim.split()
            key_words = [w for w in words if len(w) > 3 and w[0].isupper()][:5]
            parts.extend(key_words)

        if not parts:
            return None

        return " ".join(parts[:8])

    def _generate_evidence_query(self, claim: str, analysis: Optional[ClaimAnalysis]) -> Optional[str]:
        """Generate claim + evidence query."""
        base = self._get_claim_keywords(claim, analysis)
        if not base:
            return None

        evidence_terms = ["evidence", "proof", "data", "study", "research", "findings"]
        return f"{base} {' '.join(evidence_terms[:2])}"

    def _generate_study_query(self, claim: str, analysis: Optional[ClaimAnalysis]) -> Optional[str]:
        """Generate claim + study query."""
        base = self._get_claim_keywords(claim, analysis)
        if not base:
            return None

        study_terms = ["study", "research", "systematic review", "meta-analysis", "clinical trial"]
        return f"{base} {' '.join(study_terms[:2])}"

    def _generate_factcheck_query(self, claim: str, analysis: Optional[ClaimAnalysis]) -> Optional[str]:
        """Generate claim + fact-check query."""
        base = self._get_claim_keywords(claim, analysis)
        if not base:
            return None

        return f"{base} fact check"

    def _get_claim_keywords(self, claim: str, analysis: Optional[ClaimAnalysis]) -> str:
        """Extract key terms from claim for query building."""
        keywords = []

        if analysis:
            # Priority: numbers, dates, specific entities
            if analysis.numbers:
                keywords.extend(analysis.numbers[:3])
            if analysis.dates:
                keywords.extend(analysis.dates[:2])
            if analysis.entities:
                keywords.extend(analysis.entities[:3])
            if analysis.organizations:
                keywords.extend(analysis.organizations[:2])
            if analysis.people:
                keywords.extend(analysis.people[:1])

        # If no analysis data, extract from claim directly
        if not keywords:
            words = claim.split()
            # Get capitalized words (proper nouns) and longer words
            for w in words:
                clean = w.strip('.,!?":;()[]{}')
                if len(clean) > 3 and (clean[0].isupper() or clean.isdigit()):
                    keywords.append(clean)

        # Always include the main predicate if available
        if analysis and analysis.main_predicate:
            keywords.append(analysis.main_predicate)

        # Deduplicate
        seen = set()
        unique = []
        for k in keywords:
            k_lower = k.lower()
            if k_lower not in seen:
                seen.add(k_lower)
                unique.append(k)

        return " ".join(unique[:7]) if unique else claim[:100]