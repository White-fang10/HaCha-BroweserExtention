"""
Evidence Retrieval Schemas - Phase 9
Pydantic models for the evidence retrieval pipeline.
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, HttpUrl


class RetrievalStatus(str, Enum):
    """Status of the evidence retrieval operation."""
    SUCCESS = "SUCCESS"
    NO_RESULTS = "NO_RESULTS"
    NO_USABLE_EVIDENCE = "NO_USABLE_EVIDENCE"
    WEAK_EVIDENCE = "WEAK_EVIDENCE"
    CONFLICTING_EVIDENCE = "CONFLICTING_EVIDENCE"
    PROVIDER_ERROR = "PROVIDER_ERROR"
    TIMEOUT = "TIMEOUT"


class EvidenceDirection(str, Enum):
    """Direction of evidence relative to the claim."""
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    CONTEXTUAL = "CONTEXTUAL"
    UNCLEAR = "UNCLEAR"


class SourceType(str, Enum):
    """Classification of source types."""
    PRIMARY_OFFICIAL = "PRIMARY_OFFICIAL"
    GOVERNMENT = "GOVERNMENT"
    ACADEMIC = "ACADEMIC"
    MAJOR_NEWS = "MAJOR_NEWS"
    SPECIALIST = "SPECIALIST"
    FACT_CHECK_ORG = "FACT_CHECK_ORG"
    SECONDARY = "SECONDARY"
    FORUM_SOCIAL = "FORUM_SOCIAL"
    UNKNOWN = "UNKNOWN"


class SearchResult(BaseModel):
    """Normalized search result from any provider."""
    url: HttpUrl
    title: str
    snippet: Optional[str] = None
    publisher: Optional[str] = None
    published_at: Optional[datetime] = None
    query: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "url": "https://example.org/article",
                "title": "Example Article",
                "snippet": "Brief snippet from search results...",
                "publisher": "Example Publisher",
                "published_at": "2026-08-10T00:00:00Z",
                "query": "coffee cancer prevention study"
            }
        }
    }


class ExtractedContent(BaseModel):
    """Extracted main content from a webpage."""
    url: HttpUrl
    title: str
    author: Optional[str] = None
    publisher: Optional[str] = None
    published_at: Optional[datetime] = None
    text: str
    word_count: int
    extracted_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "json_schema_extra": {
            "example": {
                "url": "https://example.org/article",
                "title": "Example Article",
                "author": "John Doe",
                "publisher": "Example News",
                "published_at": "2026-08-10T00:00:00Z",
                "text": "Full article text...",
                "word_count": 1500,
                "extracted_at": "2026-08-12T10:30:00Z"
            }
        }
    }


class EvidenceItem(BaseModel):
    """A single piece of evidence with source metadata and scores."""
    direction: EvidenceDirection
    excerpt: str
    source_url: HttpUrl
    source_title: str
    publisher: Optional[str] = None
    published_at: Optional[datetime] = None
    retrieved_at: datetime = Field(default_factory=datetime.utcnow)

    relevance_score: float = Field(ge=0.0, le=1.0)
    authority_score: float = Field(ge=0.0, le=1.0)
    recency_score: float = Field(ge=0.0, le=1.0)

    source_type: SourceType = SourceType.UNKNOWN
    chunk_index: int = 0
    content_hash: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "direction": "CONTRADICTS",
                "excerpt": "The official report states that the claimed event did not occur...",
                "source_url": "https://example.org/report",
                "source_title": "Official Report",
                "publisher": "Example Government",
                "published_at": "2026-08-08T00:00:00Z",
                "retrieved_at": "2026-08-12T10:30:00Z",
                "relevance_score": 0.96,
                "authority_score": 0.98,
                "recency_score": 0.94,
                "source_type": "PRIMARY_OFFICIAL",
                "chunk_index": 0,
                "content_hash": "sha256:abc123..."
            }
        }
    }


class EvidencePackage(BaseModel):
    """Complete evidence package for a claim."""
    claim: str
    retrieval_status: RetrievalStatus
    evidence: list[EvidenceItem] = Field(default_factory=list)

    supporting_count: int = 0
    contradicting_count: int = 0
    independent_domain_count: int = 0

    retrieval_started_at: datetime
    retrieval_completed_at: datetime
    queries_generated: int = 0
    search_results_received: int = 0
    unique_urls_fetched: int = 0
    pages_successfully_extracted: int = 0
    total_latency_ms: int = 0

    model_config = {
        "json_schema_extra": {
            "example": {
                "claim": "Example claim",
                "retrieval_status": "SUCCESS",
                "evidence": [
                    {
                        "direction": "CONTRADICTS",
                        "excerpt": "The official report states that the claimed event did not occur...",
                        "source_url": "https://example.org/report",
                        "source_title": "Official Report",
                        "publisher": "Example Government",
                        "published_at": "2026-08-08T00:00:00Z",
                        "retrieved_at": "2026-08-12T10:30:00Z",
                        "relevance_score": 0.96,
                        "authority_score": 0.98,
                        "recency_score": 0.94,
                        "source_type": "PRIMARY_OFFICIAL",
                        "chunk_index": 0,
                        "content_hash": "sha256:abc123..."
                    }
                ],
                "supporting_count": 0,
                "contradicting_count": 1,
                "independent_domain_count": 1,
                "retrieval_started_at": "2026-08-12T10:29:00Z",
                "retrieval_completed_at": "2026-08-12T10:30:00Z",
                "queries_generated": 3,
                "search_results_received": 15,
                "unique_urls_fetched": 8,
                "pages_successfully_extracted": 5,
                "total_latency_ms": 12000
            }
        }
    }


class ClaimAnalysis(BaseModel):
    """Structured analysis of a claim for query generation."""
    entities: list[str] = Field(default_factory=list)
    numbers: list[str] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)
    organizations: list[str] = Field(default_factory=list)
    people: list[str] = Field(default_factory=list)
    main_predicate: Optional[str] = None
    claim_subject: Optional[str] = None
    claim_object: Optional[str] = None
    temporal_expressions: list[str] = Field(default_factory=list)
    claim_type: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "entities": ["WHO", "India", "diabetes"],
                "numbers": ["40%", "2030"],
                "dates": ["2030"],
                "locations": ["India"],
                "organizations": ["WHO"],
                "people": [],
                "main_predicate": "reported",
                "claim_subject": "adults in India",
                "claim_object": "develop diabetes",
                "temporal_expressions": ["by 2030"],
                "claim_type": "HEALTH"
            }
        }
    }