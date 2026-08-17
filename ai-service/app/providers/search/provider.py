"""
Search Provider Implementation - Phase 9
Real search provider using Brave Search API (or similar).
"""
import os
from typing import Optional
import httpx
from app.schemas.evidence import SearchResult
from app.providers.search.base import SearchProvider, MockSearchProvider


class BraveSearchProvider(SearchProvider):
    """Brave Search API provider."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.search.brave.com/res/v1/web/search"
    ):
        self._api_key = api_key or os.getenv("BRAVE_SEARCH_API_KEY")
        self._base_url = base_url
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def name(self) -> str:
        return "brave"

    @property
    def max_results_per_query(self) -> int:
        return 20

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": self._api_key or "",
                },
                timeout=10.0,
            )
        return self._client

    async def search(
        self,
        query: str,
        language: str = "en",
        limit: int = 10
    ) -> list[SearchResult]:
        if not self._api_key:
            return []

        client = await self._get_client()
        params = {
            "q": query,
            "count": min(limit, self.max_results_per_query),
            "safesearch": "moderate",
            "freshness": "all",
        }

        try:
            response = await client.get(self._base_url, params=params)
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("web", {}).get("results", []):
                published_at = None
                if "age" in item:
                    # Brave returns age like "2 days ago" - parse if needed
                    pass

                results.append(SearchResult(
                    url=item.get("url", ""),
                    title=item.get("title", ""),
                    snippet=item.get("description"),
                    publisher=item.get("meta", {}).get("publisher"),
                    published_at=published_at,
                    query=query
                ))

            return results

        except httpx.HTTPError as e:
            # Log error but don't crash - return empty results
            return []

    async def health_check(self) -> bool:
        if not self._api_key:
            return False
        try:
            client = await self._get_client()
            response = await client.get(self._base_url, params={"q": "test", "count": 1})
            return response.status_code == 200
        except Exception:
            return False

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None


class SerpApiProvider(SearchProvider):
    """SerpAPI Google Search provider."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://serpapi.com/search"
    ):
        self._api_key = api_key or os.getenv("SERPAPI_API_KEY")
        self._base_url = base_url
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def name(self) -> str:
        return "serpapi"

    @property
    def max_results_per_query(self) -> int:
        return 100

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    async def search(
        self,
        query: str,
        language: str = "en",
        limit: int = 10
    ) -> list[SearchResult]:
        if not self._api_key:
            return []

        client = await self._get_client()
        params = {
            "q": query,
            "engine": "google",
            "api_key": self._api_key,
            "num": min(limit, self.max_results_per_query),
            "hl": language,
            "safe": "active",
        }

        try:
            response = await client.get(self._base_url, params=params)
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("organic_results", []):
                results.append(SearchResult(
                    url=item.get("link", ""),
                    title=item.get("title", ""),
                    snippet=item.get("snippet"),
                    publisher=item.get("source"),
                    published_at=None,  # SerpAPI doesn't always provide dates
                    query=query
                ))

            return results

        except httpx.HTTPError:
            return []

    async def health_check(self) -> bool:
        if not self._api_key:
            return False
        try:
            client = await self._get_client()
            response = await client.get(self._base_url, params={
                "q": "test", "engine": "google", "api_key": self._api_key, "num": 1
            })
            return response.status_code == 200
        except Exception:
            return False

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None


def get_search_provider() -> SearchProvider:
    """Factory function to get the configured search provider."""
    provider_name = os.getenv("SEARCH_PROVIDER", "mock").lower()

    if provider_name == "brave":
        return BraveSearchProvider()
    elif provider_name == "serpapi":
        return SerpApiProvider()
    else:
        return MockSearchProvider()