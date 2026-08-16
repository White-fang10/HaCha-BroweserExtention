"""
Verification Service - Phase 8 Stub Implementation
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
from app.core.config import get_settings


class VerificationService:
    """AI verification service - Phase 8 stub."""

    def __init__(self):
        self.settings = get_settings()

    async def verify(self, request: VerificationRequest) -> VerificationResponse:
        """
        Verify a claim - Phase 8 returns a stub response.

        Future phases will implement:
        - Evidence retrieval
        - RAG pipeline
        - LLM reasoning
        - Structured verdict
        """
        start_time = time.perf_counter()

        # Phase 8: Return deterministic stub response
        # The Node.js gateway handles verification cascade; this is the fallback
        data = VerificationData(
            verdict="UNVERIFIED",
            confidence=0.0,
            explanation="AI verification service is not implemented yet. Fallback to AI service placeholder.",
            sources=[],
        )

        processing_time_ms = (time.perf_counter() - start_time) * 1000

        meta = VerificationMeta(
            provider=self.settings.service_name,
            model=None,
            request_id=request.request_id,
            processing_time_ms=processing_time_ms,
        )

        return VerificationResponse(
            success=True,
            data=data,
            meta=meta,
        )

    async def health_check(self) -> dict:
        """Health check endpoint - lightweight, no model loading."""
        return {
            "status": "healthy",
            "service": self.settings.service_name,
            "version": self.settings.version,
        }

    async def readiness_check(self) -> dict:
        """Readiness check - Phase 8 always ready (no model to load)."""
        return {
            "status": "ready",
            "service": self.settings.service_name,
            "version": self.settings.version,
        }


# Singleton instance
_verification_service: Optional[VerificationService] = None


def get_verification_service() -> VerificationService:
    """Get or create the verification service singleton."""
    global _verification_service
    if _verification_service is None:
        _verification_service = VerificationService()
    return _verification_service