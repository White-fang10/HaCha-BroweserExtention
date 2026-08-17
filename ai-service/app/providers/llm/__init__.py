"""
LLM Provider Factory - Phase 10
"""
import os
from typing import Optional
from app.providers.llm.base import LLMProvider, TestLLMProvider, LLMResponse
from app.providers.llm.local import LocalLLMProvider
from app.providers.llm.hosted import HostedLLMProvider


def get_llm_provider() -> LLMProvider:
    """
    Factory function to get the configured LLM provider.

    Provider precedence:
    1. TEST (if LLM_PROVIDER=test) - for unit tests
    2. LOCAL (if LLM_PROVIDER=local or unset) - default for privacy
    3. HOSTED (if LLM_PROVIDER=hosted) - requires API key
    """
    provider_name = os.getenv("LLM_PROVIDER", "local").lower()

    if provider_name == "test":
        return TestLLMProvider()
    elif provider_name == "local":
        return LocalLLMProvider()
    elif provider_name == "hosted":
        return HostedLLMProvider()
    else:
        # Default to local for privacy
        return LocalLLMProvider()


async def warm_up_provider(provider: LLMProvider) -> bool:
    """Warm up the provider if it supports it (e.g., local model loading)."""
    if hasattr(provider, "warm_up"):
        return await provider.warm_up()
    return True


__all__ = [
    "LLMProvider",
    "TestLLMProvider",
    "LocalLLMProvider",
    "HostedLLMProvider",
    "LLMResponse",
    "get_llm_provider",
    "warm_up_provider",
]