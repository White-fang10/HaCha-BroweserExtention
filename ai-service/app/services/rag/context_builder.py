"""
RAG Context Builder - Phase 10
Transforms Phase 9 EvidencePackage into bounded RAG context for LLM.
"""
from typing import Optional
from app.schemas.evidence import EvidencePackage, EvidenceDirection, SourceType
from app.schemas.verdict import RAGContext, RAGContextItem


class ContextBuilder:
    """
    Builds a bounded, ordered RAG context from an EvidencePackage.

    Strategy:
    - Prioritize high-relevance, high-authority, diverse-domain evidence
    - Preserve contradictory evidence (don't filter by agreement)
    - Bound total context by item count and excerpt length
    - Order: official primary > supporting > contradicting > contextual
    """

    def __init__(
        self,
        max_items: int = 8,
        max_excerpt_chars: int = 1000,
        min_relevance: float = 0.3,
        diversity_per_domain: int = 2,
    ):
        self.max_items = max_items
        self.max_excerpt_chars = max_excerpt_chars
        self.min_relevance = min_relevance
        self.diversity_per_domain = diversity_per_domain

    def build(self, package: EvidencePackage) -> RAGContext:
        """
        Build RAG context from evidence package.

        Returns RAGContext with ordered, filtered evidence items.
        """
        if not package.evidence:
            return RAGContext(
                claim=package.claim,
                evidence=[],
                max_items=self.max_items,
                max_excerpt_chars=self.max_excerpt_chars,
            )

        # Filter by minimum relevance
        filtered = [e for e in package.evidence if e.relevance_score >= self.min_relevance]

        if not filtered:
            # If all filtered out, keep top by relevance
            filtered = sorted(package.evidence, key=lambda e: e.relevance_score, reverse=True)[:3]

        # Order evidence: primary/official first, then supporting, contradicting, contextual
        ordered = self._order_evidence(filtered)

        # Apply domain diversity
        diversified = self._apply_domain_diversity(ordered)

        # Take top N
        selected = diversified[:self.max_items]

        # Convert to RAGContextItem
        context_items = [
            RAGContextItem(
                evidence_id=f"E{i+1}",
                direction=e.direction.value,
                source_type=e.source_type.value,
                publisher=e.publisher,
                published_at=e.published_at.isoformat() if e.published_at else None,
                excerpt=e.excerpt,
                source_url=str(e.source_url),
                relevance_score=e.relevance_score,
                authority_score=e.authority_score,
                recency_score=e.recency_score,
            )
            for i, e in enumerate(selected)
        ]

        return RAGContext(
            claim=package.claim,
            evidence=context_items,
            max_items=self.max_items,
            max_excerpt_chars=self.max_excerpt_chars,
        )

    def _order_evidence(self, evidence: list) -> list:
        """
        Order evidence by priority:
        1. PRIMARY_OFFICIAL / GOVERNMENT / FACT_CHECK_ORG (primary sources)
        2. SUPPORTS direction
        3. CONTRADICTS direction
        4. CONTEXTUAL / ACADEMIC / MAJOR_NEWS
        5. UNCLEAR / others
        Within each group, sort by combined relevance + authority score.
        """
        def priority_key(item):
            source_type_priority = {
                SourceType.PRIMARY_OFFICIAL: 0,
                SourceType.GOVERNMENT: 1,
                SourceType.FACT_CHECK_ORG: 2,
                SourceType.ACADEMIC: 3,
                SourceType.MAJOR_NEWS: 4,
                SourceType.SPECIALIST: 5,
                SourceType.SECONDARY: 6,
                SourceType.FORUM_SOCIAL: 7,
                SourceType.UNKNOWN: 8,
            }

            direction_priority = {
                EvidenceDirection.SUPPORTS: 0,
                EvidenceDirection.CONTRADICTS: 1,
                EvidenceDirection.CONTEXTUAL: 2,
                EvidenceDirection.UNCLEAR: 3,
            }

            type_prio = source_type_priority.get(item.source_type, 8)
            dir_prio = direction_priority.get(item.direction, 3)

            # Combined quality score
            quality = (item.relevance_score + item.authority_score) / 2

            return (type_prio, dir_prio, -quality)

        return sorted(evidence, key=priority_key)

    def _apply_domain_diversity(self, evidence: list) -> list:
        """Limit evidence per domain for source diversity."""
        from urllib.parse import urlparse
        from collections import defaultdict

        domain_counts = defaultdict(int)
        diversified = []

        for item in evidence:
            domain = urlparse(str(item.source_url)).netloc.lower()
            if domain_counts[domain] < self.diversity_per_domain:
                domain_counts[domain] += 1
                diversified.append(item)

        return diversified