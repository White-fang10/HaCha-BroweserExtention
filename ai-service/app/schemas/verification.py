"""
Verification Request/Response Schemas - Phase 8
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
import re


class VerificationSource(BaseModel):
    """Source citation for verification result."""
    title: str = Field(..., min_length=1)
    url: str = Field(..., min_length=1)
    publisher: str = Field(..., min_length=1)
    publish_date: str = Field(..., min_length=1)
    relevance_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    snippet: Optional[str] = Field(default=None)


class VerificationData(BaseModel):
    """Core verification result data."""
    verdict: str = Field(..., pattern="^(SUPPORTED|FALSE|MISLEADING|UNVERIFIED)$")
    confidence: float = Field(..., ge=0.0, le=1.0)
    explanation: str = Field(..., min_length=1)
    sources: List[VerificationSource] = Field(default_factory=list)


class VerificationMeta(BaseModel):
    """Metadata about the verification response."""
    provider: str = Field(..., min_length=1)
    model: Optional[str] = Field(default=None)
    request_id: str = Field(..., min_length=1)
    processing_time_ms: Optional[float] = Field(default=None, ge=0.0)


class VerificationResponse(BaseModel):
    """Full verification response envelope."""
    success: bool
    data: VerificationData
    meta: VerificationMeta


class VerificationRequest(BaseModel):
    """Verification request from Node.js gateway."""
    claim: str = Field(..., min_length=1, max_length=5000)
    claim_hash: str = Field(..., min_length=64, max_length=64)
    language: str = Field(default="en", min_length=2, max_length=5)
    request_id: str = Field(..., min_length=1)

    @field_validator("claim_hash")
    @classmethod
    def validate_claim_hash(cls, v: str) -> str:
        """Validate SHA-256 hash format (64 hex characters)."""
        if not re.match(r"^[a-f0-9]{64}$", v):
            raise ValueError("claim_hash must be a 64-character SHA-256 hex string")
        return v

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        """Validate language code."""
        allowed = {"en", "es", "fr", "de", "zh", "ja", "ko", "hi", "ar"}
        if v.lower() not in allowed:
            raise ValueError(f"language must be one of: {', '.join(sorted(allowed))}")
        return v.lower()