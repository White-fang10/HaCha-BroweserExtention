"""
Verification Service - Phase 10 with RAG + LLM Reasoning
"""
import time
import uuid
from typing import Optional
from app.schemas.verification import (
    VerificationRequest,
    VerificationResponse,
    VerificationData,
    VerificationMeta,
    VerificationSource,
)
from app.schemas.evidence import EvidencePackage, RetrievalStatus, EvidenceDirection
from app.schemas.verdict import VerifiedVerdict, Verdict
from app.core.config import get_settings
from app.services.retrieval.retrieval_service import get_retrieval_service, close_retrieval_service
from app.services.reasoning import ReasoningService
from app.providers.llm import get_llm_provider, warm_up_provider


class VerificationService:
    """AI verification service with RAG + LLM reasoning (Phase 10)."""

    def __init__(self):
        self.settings = get_settings()
        self.retrieval_service = get_retrieval_service()
        self.llm_provider = get_llm_provider()
        self.reasoning_service = ReasoningService(llm_provider=self.llm_provider)

    async def verify(self, request: VerificationRequest) -> VerificationResponse:
        """
        Verify a claim using RAG + LLM reasoning pipeline (Phase 10).

        Pipeline:
        1. Evidence retrieval (Phase 9)
        2. RAG context construction
        3. LLM reasoning with structured output
        4. Grounding and verdict validation
        5. Final verified verdict
        """
        start_time = time.perf_counter()

        # Run evidence retrieval (Phase 9)
        package: EvidencePackage = await self.retrieval_service.retrieve(
            claim=request.claim,
            language=request.language,
            request_id=request.request_id,
        )

        # Run RAG + LLM reasoning (Phase 10)
        verified_verdict: VerifiedVerdict = await self.reasoning_service.reason(package)

        # Convert to verification response format
        sources = self._verified_verdict_to_sources(verified_verdict)

        data = VerificationData(
            verdict=verified_verdict.verdict.value,
            confidence=verified_verdict.confidence,
            explanation=verified_verdict.reasoning,
            sources=sources,
        )

        processing_time_ms = (time.perf_counter() - start_time) * 1000

        meta = VerificationMeta(
            provider=self.settings.service_name,
            model=verified_verdict.model_name or "unknown",
            request_id=request.request_id,
            processing_time_ms=processing_time_ms,
        )

        return VerificationResponse(
            success=True,
            data=data,
            meta=meta,
        )

    def _verified_verdict_to_sources(self, verdict: VerifiedVerdict) -> list[VerificationSource]:
        """Convert verified verdict evidence to verification sources."""
        sources = []
        for ref in verdict.evidence:
            sources.append(VerificationSource(
                title=ref.source_title,
                url=ref.source_url,
                publisher=ref.publisher or "Unknown",
                publish_date=ref.published_at or "",
                relevance_score=ref.relevance_score,
                snippet=ref.excerpt[:300] if ref.excerpt else None,
            ))
        return sources

    async def health_check(self) -> dict:
        """Health check endpoint - lightweight, no model loading."""
        return {
            "status": "healthy",
            "service": self.settings.service_name,
            "version": self.settings.version,
        }

    async def readiness_check(self) -> dict:
        """Readiness check - verify search provider and LLM are accessible."""
        try:
            search_healthy = await self.retrieval_service.search_provider.health_check()
            llm_healthy = await self.llm_provider.health_check()

            all_ready = search_healthy and llm_healthy

            return {
                "status": "ready" if all_ready else "degraded",
                "service": self.settings.service_name,
                "version": self.settings.version,
                "search_provider": self.retrieval_service.search_provider.name,
                "search_provider_healthy": search_healthy,
                "llm_provider": self.llm_provider.name,
                "llm_model": self.llm_provider.model_name,
                "llm_healthy": llm_healthy,
            }
        except Exception as e:
            return {
                "status": "not_ready",
                "service": self.settings.service_name,
                "version": self.settings.version,
                "error": str(e),
            }

    async def close(self) -> None:
        """Clean up resources."""
        await close_retrieval_service()
        await self.llm_provider.close()


# Singleton instance
_verification_service: Optional[VerificationService] = None


def get_verification_service() -> VerificationService:
    """Get or create the verification service singleton."""
    global _verification_service
    if _verification_service is None:
        _verification_service = VerificationService()
    return _verification_service