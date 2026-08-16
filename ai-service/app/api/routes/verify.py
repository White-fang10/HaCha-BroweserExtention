"""
Verification Route - Phase 8
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from app.schemas.verification import VerificationRequest, VerificationResponse
from app.services.verification_service import get_verification_service
from app.core.config import get_settings

router = APIRouter(tags=["verification"])

settings = get_settings()


async def verify_internal_token(authorization: str = Header(...)) -> None:
    """Verify internal service token for AI service access."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization[7:]  # Remove "Bearer " prefix
    if token != settings.internal_token:
        raise HTTPException(status_code=403, detail="Invalid internal service token")


@router.post("/verify", response_model=VerificationResponse, dependencies=[Depends(verify_internal_token)])
async def verify_claim(
    request: VerificationRequest,
    service=Depends(get_verification_service),
) -> VerificationResponse:
    """
    Verify a claim against AI evidence pipeline.

    Phase 8: Returns stub response.
    Future phases: Evidence retrieval, RAG, LLM reasoning.
    """
    return await service.verify(request)