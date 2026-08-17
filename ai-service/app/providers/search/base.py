"""
Search Provider Interface - Phase 9
Abstract base class for search providers.
"""
from abc import ABC, abstractmethod
from typing import Optional
from app.schemas.evidence import SearchResult


class SearchProvider(ABC):
    """Abstract interface for search providers."""

    @abstractmethod
    async def search(
        self,
        query: str,
        language: str = "en",
        limit: int = 10
    ) -> list[SearchResult]:
        """
        Perform a search query.

        Args:
            query: The search query string
            language: Language code for results (e.g., "en")
            limit: Maximum number of results to return

        Returns:
            List of normalized SearchResult objects
        """
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if the search provider is healthy.

        Returns:
            True if provider is operational
        """
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name for logging/metrics."""
        ...

    @property
    @abstractmethod
    def max_results_per_query(self) -> int:
        """Maximum results this provider can return per query."""
        ...


class MockSearchProvider(SearchProvider):
    """Mock search provider for testing."""

    def __init__(self, results: Optional[list[SearchResult]] = None):
        self._results = results or []
        self._healthy = True
        self.call_count = 0

    @property
    def name(self) -> str:
        return "mock"

    @property
    def max_results_per_query(self) -> int:
        return 10

    async def search(
        self,
        query: str,
        language: str = "en",
        limit: int = 10
    ) -> list[SearchResult]:
        self.call_count += 1
        return self._results[:limit]

    async def health_check(self) -> bool:
        return self._healthy

    def set_results(self, results: list[SearchResult]) -> None:
        """Set mock results for testing."""
        self._results = results

    def set_healthy(self, healthy: bool) -> None:
        """Set health status for testing."""
        self._healthy = healthy