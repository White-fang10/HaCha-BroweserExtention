"""
AI Service Configuration - Phase 8
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