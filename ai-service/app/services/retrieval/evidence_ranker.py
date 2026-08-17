"""
Evidence Ranker - Phase 9
Rank and filter evidence items for final evidence package.
"""
import hashlib
from datetime import datetime, timezone
from typing import Optional
from collections import defaultdict
from app.schemas.evidence import EvidenceItem, EvidencePackage, RetrievalStatus, SourceType
from app.services.retrieval.source_filter import SourceFilter, SourceQualityScorer


class EvidenceRanker:
    """Rank evidence items and build final evidence package."""

    def __init__(
        self,
        max_evidence_items: int = 10,
        min_relevance: float = 0.3,
        diversity_per_domain: int = 2,
        similarity_threshold: float = 0.85,
    ):
        self.max_evidence_items = max_evidence_items
        self.min_relevance = min_relevance
        self.diversity_per_domain = diversity_per_domain
        self.similarity_threshold = similarity_threshold
        self.quality_scorer = SourceQualityScorer(SourceFilter())

    def rank_and_package(
        self,
        claim: str,
        evidence_items: list[EvidenceItem],
        search_results: list,
        queries_generated: int,
        retrieval_started_at: datetime,
    ) -> EvidencePackage:
        """Rank evidence and create final package."""
        # Filter by minimum relevance
        filtered = [e for e in evidence_items if e.relevance_score >= self.min_relevance]

        # Apply quality scores from source metadata
        scored = self._apply_quality_scores(filtered)

        # Deduplicate similar content
        deduplicated = self._deduplicate_content(scored)

        # Apply domain diversity
        diversified = self._apply_domain_diversity(deduplicated)

        # Final ranking by combined score
        ranked = self._calculate_combined_score(diversified)
        ranked.sort(key=lambda e: e.combined_score, reverse=True)

        # Take top N
        final_evidence = ranked[:self.max_evidence_items]

        # Count supporting/contradicting
        supporting = sum(1 for e in final_evidence if e.direction == "SUPPORTS")
        contradicting = sum(1 for e in final_evidence if e.direction == "CONTRADICTS")

        # Count independent domains
        domains = set()
        for e in final_evidence:
            from urllib.parse import urlparse
            domain = urlparse(str(e.source_url)).netloc.lower()
            domains.add(domain)

        # Determine retrieval status
        status = self._determine_status(final_evidence, supporting, contradicting)

        retrieval_completed_at = datetime.now(timezone.utc)
        total_latency = int((retrieval_completed_at - retrieval_started_at).total_seconds() * 1000)

        return EvidencePackage(
            claim=claim,
            retrieval_status=status,
            evidence=final_evidence,
            supporting_count=supporting,
            contradicting_count=contradicting,
            independent_domain_count=len(domains),
            retrieval_started_at=retrieval_started_at,
            retrieval_completed_at=retrieval_completed_at,
            queries_generated=queries_generated,
            search_results_received=len(search_results),
            unique_urls_fetched=len(set(str(e.source_url) for e in evidence_items)),
            pages_successfully_extracted=len(set(str(e.source_url) for e in evidence_items if e.excerpt)),
            total_latency_ms=total_latency,
        )

    def _apply_quality_scores(self, evidence_items: list[EvidenceItem]) -> list[EvidenceItem]:
        """Apply authority and recency scores based on source."""
        scored = []
        for item in evidence_items:
            # Create a mock search result for scoring
            from app.schemas.evidence import SearchResult
            mock_result = SearchResult(
                url=item.source_url,
                title=item.source_title,
                publisher=item.publisher,
                published_at=item.published_at,
                query=""
            )
            scores = self.quality_scorer.score(mock_result)

            # Create new item with updated scores
            scored.append(EvidenceItem(
                **item.model_dump(),
                authority_score=scores['authority_score'],
                recency_score=scores['recency_score'],
                source_type=scores['source_type'],
            ))
        return scored

    def _deduplicate_content(self, evidence_items: list[EvidenceItem]) -> list[EvidenceItem]:
        """Remove near-duplicate evidence using content hash and text similarity."""
        if not evidence_items:
            return []

        # Group by content hash first (exact duplicates)
        by_hash = {}
        for item in evidence_items:
            if item.content_hash not in by_hash:
                by_hash[item.content_hash] = item

        unique = list(by_hash.values())

        # Then check text similarity for near-duplicates
        final = []
        for item in unique:
            is_duplicate = False
            for existing in final:
                if self._text_similarity(item.excerpt, existing.excerpt) >= self.similarity_threshold:
                    is_duplicate = True
                    break
            if not is_duplicate:
                final.append(item)

        return final

    def _text_similarity(self, text1: str, text2: str) -> float:
        """Simple Jaccard similarity for deduplication."""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = words1 & words2
        union = words1 | words2

        return len(intersection) / len(union)

    def _apply_domain_diversity(self, evidence_items: list[EvidenceItem]) -> list[EvidenceItem]:
        """Limit evidence per domain for diversity."""
        from urllib.parse import urlparse

        domain_counts = defaultdict(int)
        diversified = []

        for item in evidence_items:
            domain = urlparse(str(item.source_url)).netloc.lower()
            if domain_counts[domain] < self.diversity_per_domain:
                domain_counts[domain] += 1
                diversified.append(item)

        return diversified

    def _calculate_combined_score(self, evidence_items: list[EvidenceItem]) -> list[EvidenceItem]:
        """Calculate combined ranking score."""
        scored = []
        for item in evidence_items:
            # Weighted combination
            combined = (
                0.4 * item.relevance_score +
                0.3 * item.authority_score +
                0.2 * item.recency_score +
                0.1 * (1.0 if item.direction == "SUPPORTS" else 0.5)
            )

            # Penalize unclear direction
            if item.direction == "UNCLEAR":
                combined *= 0.7

            # Boost primary sources
            if item.source_type == SourceType.PRIMARY_OFFICIAL:
                combined *= 1.15
            elif item.source_type == SourceType.GOVERNMENT:
                combined *= 1.1
            elif item.source_type == SourceType.ACADEMIC:
                combined *= 1.1

            # Create item with combined score (add as extra field)
            item_dict = item.model_dump()
            item_dict['combined_score'] = combined
            scored.append(EvidenceItem(**item_dict))

        return scored

    def _determine_status(
        self,
        evidence: list[EvidenceItem],
        supporting: int,
        contradicting: int
    ) -> RetrievalStatus:
        """Determine retrieval status based on evidence."""
        if not evidence:
            return RetrievalStatus.NO_USABLE_EVIDENCE

        if supporting > 0 and contradicting > 0:
            # Both directions present
            if supporting >= 2 and contradicting >= 2:
                return RetrievalStatus.CONFLICTING_EVIDENCE
            return RetrievalStatus.SUCCESS

        if supporting > 0 or contradicting > 0:
            return RetrievalStatus.SUCCESS

        # Has evidence but unclear direction
        if any(e.direction == "CONTEXTUAL" for e in evidence):
            return RetrievalStatus.WEAK_EVIDENCE

        return RetrievalStatus.WEAK_EVIDENCE