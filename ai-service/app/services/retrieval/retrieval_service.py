"""
Retrieval Service - Phase 9
Main orchestration service for the evidence retrieval pipeline.
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional
from app.schemas.evidence import (
    EvidencePackage, RetrievalStatus, SearchResult,
    ClaimAnalysis
)
from app.services.retrieval.claim_analyzer import ClaimAnalyzer
from app.services.retrieval.query_generator import QueryGenerator
from app.providers.search.base import SearchProvider
from app.providers.search.provider import get_search_provider
from app.services.retrieval.source_filter import SourceFilter
from app.services.retrieval.content_fetcher import ContentFetcher
from app.services.retrieval.content_extractor import ContentExtractor
from app.services.retrieval.evidence_extractor import EvidenceExtractor
from app.services.retrieval.evidence_ranker import EvidenceRanker
from app.core.logging import get_logger
from app.core.config import get_settings


logger = get_logger(__name__)


class RetrievalService:
    """Orchestrate the complete evidence retrieval pipeline."""

    def __init__(
        self,
        search_provider: Optional[SearchProvider] = None,
        max_queries: Optional[int] = None,
        max_results_per_query: Optional[int] = None,
        max_concurrent_fetches: Optional[int] = None,
        max_evidence_items: Optional[int] = None,
        fetch_timeout: Optional[float] = None,
    ):
        self.settings = get_settings()

        self.search_provider = search_provider or get_search_provider()
        self.claim_analyzer = ClaimAnalyzer()
        self.query_generator = QueryGenerator(max_queries=max_queries or self.settings.retrieval_max_queries)
        self.source_filter = SourceFilter(
            max_results_per_domain=self.settings.retrieval_max_per_domain,
            blocked_domains=set(self.settings.retrieval_blocked_domains.split(",")) if self.settings.retrieval_blocked_domains else set(),
        )
        self.content_fetcher = ContentFetcher(
            max_concurrent=max_concurrent_fetches or self.settings.retrieval_max_concurrent_fetches,
            timeout_seconds=fetch_timeout or self.settings.retrieval_fetch_timeout_seconds,
            source_filter=self.source_filter,
        )
        self.content_extractor = ContentExtractor()
        self.evidence_extractor = EvidenceExtractor()
        self.evidence_ranker = EvidenceRanker(max_evidence_items=max_evidence_items or self.settings.retrieval_max_evidence_items)

        self.max_results_per_query = max_results_per_query or self.settings.retrieval_max_results_per_query

    async def retrieve(self, claim: str, language: str = "en", request_id: str = "") -> EvidencePackage:
        """Execute the full retrieval pipeline."""
        retrieval_started_at = datetime.now(timezone.utc)
        logger.info("Starting evidence retrieval", extra={"request_id": request_id, "claim": claim[:100]})

        try:
            # Step 1: Analyze claim
            analysis = self.claim_analyzer.analyze(claim)
            logger.debug("Claim analyzed", extra={"request_id": request_id, "entities": analysis.entities[:5]})

            # Step 2: Generate queries
            queries = self.query_generator.generate(claim, analysis)
            logger.info("Queries generated", extra={"request_id": request_id, "count": len(queries), "queries": queries})

            # Step 3: Execute searches
            all_results = []
            for query in queries:
                try:
                    results = await self.search_provider.search(query, language, self.max_results_per_query)
                    all_results.extend(results)
                except Exception as e:
                    logger.warning("Search query failed", extra={"request_id": request_id, "query": query, "error": str(e)})

            logger.info("Search results received", extra={"request_id": request_id, "total": len(all_results)})

            # Step 4: Filter and deduplicate sources
            filtered_results = self.source_filter.filter_results(all_results)
            logger.info("Sources filtered", extra={"request_id": request_id, "filtered": len(filtered_results)})

            if not filtered_results:
                return self._empty_package(claim, RetrievalStatus.NO_RESULTS, retrieval_started_at, len(queries), 0)

            # Step 5: Fetch content
            extracted_contents = await self.content_fetcher.fetch_multiple(filtered_results)
            logger.info("Content fetched", extra={"request_id": request_id, "successful": len(extracted_contents)})

            if not extracted_contents:
                return self._empty_package(claim, RetrievalStatus.NO_USABLE_EVIDENCE, retrieval_started_at, len(queries), len(all_results))

            # Step 6: Extract main content from HTML
            main_contents = []
            for content in extracted_contents:
                extracted = self.content_extractor.extract(content)
                if extracted:
                    main_contents.append(extracted)

            logger.info("Content extracted", extra={"request_id": request_id, "extracted": len(main_contents)})

            if not main_contents:
                return self._empty_package(claim, RetrievalStatus.NO_USABLE_EVIDENCE, retrieval_started_at, len(queries), len(all_results))

            # Step 7: Extract evidence passages
            all_evidence = []
            claim_keywords = self.evidence_extractor._extract_claim_keywords(claim)

            for content in main_contents:
                source_type = self.source_filter.classify_source(
                    SearchResult(url=content.url, title=content.title, query="")
                )
                evidence = self.evidence_extractor.extract(claim, content, source_type, claim_keywords)
                all_evidence.extend(evidence)

            logger.info("Evidence extracted", extra={"request_id": request_id, "passages": len(all_evidence)})

            if not all_evidence:
                return self._empty_package(
                    claim, RetrievalStatus.WEAK_EVIDENCE, retrieval_started_at,
                    len(queries), len(all_results), len(filtered_results), len(main_contents)
                )

            # Step 8: Rank and package
            package = self.evidence_ranker.rank_and_package(
                claim=claim,
                evidence_items=all_evidence,
                search_results=all_results,
                queries_generated=len(queries),
                retrieval_started_at=retrieval_started_at,
            )

            logger.info(
                "Retrieval completed",
                extra={
                    "request_id": request_id,
                    "status": package.retrieval_status.value,
                    "evidence_count": len(package.evidence),
                    "supporting": package.supporting_count,
                    "contradicting": package.contradicting_count,
                    "latency_ms": package.total_latency_ms,
                }
            )

            return package

        except Exception as e:
            logger.error("Retrieval pipeline failed", extra={"request_id": request_id, "error": str(e)})
            return self._empty_package(claim, RetrievalStatus.PROVIDER_ERROR, retrieval_started_at, 0, 0)

    def _empty_package(
        self,
        claim: str,
        status: RetrievalStatus,
        started_at: datetime,
        queries: int,
        search_results: int,
        unique_urls: int = 0,
        extracted: int = 0,
    ) -> EvidencePackage:
        """Create an empty evidence package with status."""
        completed_at = datetime.now(timezone.utc)
        latency = int((completed_at - started_at).total_seconds() * 1000)

        return EvidencePackage(
            claim=claim,
            retrieval_status=status,
            evidence=[],
            supporting_count=0,
            contradicting_count=0,
            independent_domain_count=0,
            retrieval_started_at=started_at,
            retrieval_completed_at=completed_at,
            queries_generated=queries,
            search_results_received=search_results,
            unique_urls_fetched=unique_urls,
            pages_successfully_extracted=extracted,
            total_latency_ms=latency,
        )

    async def close(self) -> None:
        """Clean up resources."""
        await self.content_fetcher.close()
        if hasattr(self.search_provider, 'close'):
            await self.search_provider.close()


# Global instance for FastAPI dependency injection
_retrieval_service: Optional[RetrievalService] = None


def get_retrieval_service() -> RetrievalService:
    """Get or create the global retrieval service instance."""
    global _retrieval_service
    if _retrieval_service is None:
        _retrieval_service = RetrievalService()
    return _retrieval_service


async def close_retrieval_service() -> None:
    """Close the global retrieval service."""
    global _retrieval_service
    if _retrieval_service:
        await _retrieval_service.close()
        _retrieval_service = None