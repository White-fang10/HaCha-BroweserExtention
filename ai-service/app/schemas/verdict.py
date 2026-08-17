"""
Verdict Response Schemas - Phase 10
Pydantic models for LLM reasoning output and final verdict.
"""
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class Verdict(str, Enum):
    """Final verdict taxonomy."""
    SUPPORTED = "SUPPORTED"
    FALSE = "FALSE"
    MISLEADING = "MISLEADING"
    UNVERIFIED = "UNVERIFIED"
    AI_ERROR = "AI_ERROR"


class LLMVerdictResponse(BaseModel):
    """
    Raw LLM structured output before backend validation.
    Uses evidence IDs (E1, E2, ...) for citations.
    """
    verdict: Verdict
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str = Field(min_length=1)
    reasoning: str = Field(min_length=1)
    supporting_evidence: list[str] = Field(default_factory=list)
    contradicting_evidence: list[str] = Field(default_factory=list)
    contextual_evidence: list[str] = Field(default_factory=list)

    @field_validator("verdict", mode="before")
    @classmethod
    def normalize_verdict(cls, v: str) -> str:
        """Normalize verdict to uppercase."""
        return v.upper()


class EvidenceReference(BaseModel):
    """Backend-resolved evidence reference with full source metadata."""
    id: str
    direction: str
    excerpt: str
    source_title: str
    publisher: Optional[str] = None
    source_url: str
    published_at: Optional[str] = None
    relevance_score: float
    authority_score: float
    recency_score: float
    source_type: str


class VerifiedVerdict(BaseModel):
    """
    Fully validated verdict with resolved evidence references.
    This is the final output returned to the API gateway.
    """
    verdict: Verdict
    confidence: float
    summary: str
    reasoning: str
    evidence: list[EvidenceReference] = Field(default_factory=list)
    model_name: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_latency_ms: Optional[int] = None

    @field_validator("confidence", mode="before")
    @classmethod
    def bound_confidence(cls, v: float) -> float:
        """Ensure confidence is bounded [0, 1]."""
        return max(0.0, min(1.0, v))

    model_config = {
        "protected_namespaces": (),
    }


class RAGContextItem(BaseModel):
    """Single evidence item formatted for RAG context."""
    evidence_id: str
    direction: str
    source_type: str
    publisher: Optional[str] = None
    published_at: Optional[str] = None
    excerpt: str
    source_url: str
    relevance_score: float
    authority_score: float
    recency_score: float


class RAGContext(BaseModel):
    """Bounded RAG context for LLM prompt."""
    claim: str
    evidence: list[RAGContextItem] = Field(default_factory=list)
    max_items: int = 8
    max_excerpt_chars: int = 1000

    def to_prompt_sections(self) -> str:
        """Format evidence items as prompt sections with delimiters."""
        if not self.evidence:
            return "EVIDENCE\n-------------------\nNo evidence available.\n"

        sections = []
        for item in self.evidence:
            excerpt = item.excerpt[:self.max_excerpt_chars]
            section = (
                f"EVIDENCE id={item.evidence_id}\n"
                f"SOURCE_TYPE: {item.source_type}\n"
                f"DIRECTION: {item.direction}\n"
                f"PUBLISHER: {item.publisher or 'Unknown'}\n"
                f"PUBLISHED_AT: {item.published_at or 'Unknown'}\n"
                f"URL: {item.source_url}\n"
                f"RELEVANCE: {item.relevance_score:.2f}\n"
                f"AUTHORITY: {item.authority_score:.2f}\n"
                f"RECENCY: {item.recency_score:.2f}\n"
                f"CONTENT:\n{excerpt}\n"
            )
            sections.append(section)

        return "EVIDENCE\n-------------------\n" + "\n---\n".join(sections) + "\n"