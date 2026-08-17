"""
LLM Provider Base - Phase 10
Abstract interface for LLM inference providers.
"""
from abc import ABC, abstractmethod
from typing import Optional
from dataclasses import dataclass


@dataclass
class LLMResponse:
    """LLM generation response with metadata."""
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    model_name: Optional[str] = None


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Model identifier."""
        pass

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> LLMResponse:
        """
        Generate text from prompt.

        Args:
            prompt: Input prompt
            temperature: Sampling temperature (low for consistency)
            max_tokens: Maximum output tokens
            timeout_seconds: Generation timeout

        Returns:
            LLMResponse with generated text and metadata
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is available."""
        pass

    @abstractmethod
    async def close(self) -> None:
        """Clean up resources."""
        pass


class TestLLMProvider(LLMProvider):
    """
    Deterministic test provider for unit testing.
    Returns pre-configured responses without calling a real model.
    """

    def __init__(self, responses: Optional[list[str]] = None):
        self._responses = responses or []
        self._call_count = 0
        self._healthy = True

    @property
    def name(self) -> str:
        return "test"

    @property
    def model_name(self) -> str:
        return "test-model"

    def set_responses(self, responses: list[str]) -> None:
        """Set deterministic responses for sequential calls."""
        self._responses = responses
        self._call_count = 0

    def set_healthy(self, healthy: bool) -> None:
        """Set health status for testing."""
        self._healthy = healthy

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> LLMResponse:
        if not self._responses:
            # Default valid JSON response
            return LLMResponse(
                text='{"verdict": "UNVERIFIED", "confidence": 0.0, "summary": "No response configured", "reasoning": "Test provider has no configured responses", "supporting_evidence": [], "contradicting_evidence": [], "contextual_evidence": []}',
                input_tokens=len(prompt) // 4,
                output_tokens=50,
                latency_ms=10,
                model_name=self.model_name,
            )

        response = self._responses[self._call_count % len(self._responses)]
        self._call_count += 1

        return LLMResponse(
            text=response,
            input_tokens=len(prompt) // 4,
            output_tokens=len(response) // 4,
            latency_ms=10,
            model_name=self.model_name,
        )

    async def health_check(self) -> bool:
        return self._healthy

    async def close(self) -> None:
        pass