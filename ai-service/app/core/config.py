"""
AI Service Configuration - Phase 9
"""
import os
from functools import lru_cache
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Service identification
    service_name: str = Field(default="hacha-ai-service", alias="SERVICE_NAME")
    version: str = Field(default="0.1.0", alias="SERVICE_VERSION")
    environment: str = Field(default="development", alias="ENVIRONMENT")

    # Network
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")

    # Internal authentication
    internal_token: str = Field(default="development-secret", alias="AI_SERVICE_TOKEN")

    # Node.js gateway URL (for reference)
    gateway_url: str = Field(default="http://localhost:3000", alias="GATEWAY_URL")

    # Timeouts
    request_timeout_seconds: float = Field(default=30.0, alias="REQUEST_TIMEOUT_SECONDS")

    # Logging
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # Phase 9: Evidence Retrieval
    # Search provider configuration
    search_provider: str = Field(default="mock", alias="SEARCH_PROVIDER")  # mock, brave, serpapi
    brave_search_api_key: Optional[str] = Field(default=None, alias="BRAVE_SEARCH_API_KEY")
    serpapi_api_key: Optional[str] = Field(default=None, alias="SERPAPI_API_KEY")

    # Retrieval limits
    retrieval_max_queries: int = Field(default=5, alias="RETRIEVAL_MAX_QUERIES")
    retrieval_max_results_per_query: int = Field(default=10, alias="RETRIEVAL_MAX_RESULTS_PER_QUERY")
    retrieval_max_concurrent_fetches: int = Field(default=5, alias="RETRIEVAL_MAX_CONCURRENT_FETCHES")
    retrieval_max_evidence_items: int = Field(default=10, alias="RETRIEVAL_MAX_EVIDENCE_ITEMS")
    retrieval_fetch_timeout_seconds: float = Field(default=10.0, alias="RETRIEVAL_FETCH_TIMEOUT_SECONDS")
    retrieval_max_content_size_mb: int = Field(default=10, alias="RETRIEVAL_MAX_CONTENT_SIZE_MB")

    # Source filtering
    retrieval_max_per_domain: int = Field(default=3, alias="RETRIEVAL_MAX_PER_DOMAIN")
    retrieval_blocked_domains: str = Field(default="", alias="RETRIEVAL_BLOCKED_DOMAINS")

    # Phase 10: RAG + LLM Reasoning
    # LLM provider configuration
    llm_provider: str = Field(default="local", alias="LLM_PROVIDER")  # test, local, hosted
    llm_model: Optional[str] = Field(default=None, alias="LLM_MODEL")

    # Local LLM (Ollama)
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field(default="llama3.1:8b", alias="OLLAMA_MODEL")
    ollama_api_key: Optional[str] = Field(default=None, alias="OLLAMA_API_KEY")

    # Hosted LLM (OpenAI-compatible)
    hosted_llm_base_url: str = Field(default="https://api.openai.com/v1", alias="HOSTED_LLM_BASE_URL")
    hosted_llm_model: str = Field(default="gpt-4o-mini", alias="HOSTED_LLM_MODEL")
    hosted_llm_api_key: Optional[str] = Field(default=None, alias="HOSTED_LLM_API_KEY")

    # Reasoning parameters
    rag_max_evidence_items: int = Field(default=8, alias="RAG_MAX_EVIDENCE_ITEMS")
    rag_max_excerpt_chars: int = Field(default=1000, alias="RAG_MAX_EXCERPT_CHARS")
    rag_min_relevance: float = Field(default=0.3, alias="RAG_MIN_RELEVANCE")
    llm_temperature: float = Field(default=0.1, alias="LLM_TEMPERATURE")
    llm_max_tokens: int = Field(default=1024, alias="LLM_MAX_TOKENS")
    llm_timeout_seconds: float = Field(default=30.0, alias="LLM_TIMEOUT_SECONDS")
    llm_max_retries: int = Field(default=2, alias="LLM_MAX_RETRIES")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()