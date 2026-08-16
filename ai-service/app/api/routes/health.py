"""
Health and Readiness Routes - Phase 8
"""
from fastapi import APIRouter, Depends
from app.services.verification_service import get_verification_service

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(service=Depends(get_verification_service)):
    """
    Health check endpoint.

    Lightweight check - does not load models or connect to databases.
    Used for liveness probes.
    """
    return await service.health_check()


@router.get("/ready")
async def readiness_check(service=Depends(get_verification_service)):
    """
    Readiness check endpoint.

    Indicates if the service can accept verification work.
    Phase 8: always ready (no model dependencies).
    """
    return await service.readiness_check()