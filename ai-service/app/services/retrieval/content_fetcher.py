"""
Content Fetcher - Phase 9
Bounded, safe fetching of web pages with SSRF protection.
"""
import asyncio
from typing import Optional
import httpx
from app.services.retrieval.source_filter import SourceFilter
from app.schemas.evidence import SearchResult, ExtractedContent


class ContentFetcher:
    """Fetch web pages with safety and resource limits."""

    def __init__(
        self,
        max_concurrent: int = 5,
        timeout_seconds: float = 10.0,
        max_content_size: int = 10 * 1024 * 1024,  # 10 MB
        allowed_content_types: Optional[set[str]] = None,
        user_agent: str = "HaCha-FactChecker/1.0 (+https://hacha.ai/bot)",
        source_filter: Optional[SourceFilter] = None
    ):
        self.max_concurrent = max_concurrent
        self.timeout_seconds = timeout_seconds
        self.max_content_size = max_content_size
        self.allowed_content_types = allowed_content_types or {
            'text/html',
            'text/plain',
            'application/xhtml+xml',
            'application/xml',
        }
        self.user_agent = user_agent
        self.source_filter = source_filter or SourceFilter()
        self._client: Optional[httpx.AsyncClient] = None
        self._semaphore: Optional[asyncio.Semaphore] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers={"User-Agent": self.user_agent},
                follow_redirects=True,
                max_redirects=5,
                timeout=httpx.Timeout(self.timeout_seconds),
            )
            self._semaphore = asyncio.Semaphore(self.max_concurrent)
        return self._client

    async def fetch(self, result: SearchResult) -> Optional[ExtractedContent]:
        """Fetch a single URL with safety checks."""
        # Final safety check (in case redirect changed destination)
        if not self.source_filter._is_safe_url(str(result.url)):
            return None

        client = await self._get_client()

        async with self._semaphore:
            try:
                response = await client.get(str(result.url))
                response.raise_for_status()

                # Check content type
                content_type = response.headers.get('content-type', '').split(';')[0].strip().lower()
                if content_type not in self.allowed_content_types:
                    return None

                # Check content length
                content_length = response.headers.get('content-length')
                if content_length and int(content_length) > self.max_content_size:
                    return None

                # Read content with size limit
                content = await self._read_limited(response)

                if not content:
                    return None

                # Final size check
                if len(content.encode('utf-8', errors='ignore')) > self.max_content_size:
                    content = content[:self.max_content_size // 2]  # Truncate

                return ExtractedContent(
                    url=result.url,
                    title=result.title,
                    publisher=result.publisher,
                    published_at=result.published_at,
                    text=content,
                    word_count=len(content.split()),
                )

            except httpx.HTTPError:
                return None
            except asyncio.TimeoutError:
                return None
            except Exception:
                return None

    async def fetch_multiple(self, results: list[SearchResult]) -> list[ExtractedContent]:
        """Fetch multiple URLs concurrently with bounded concurrency."""
        tasks = [self.fetch(result) for result in results]
        fetched = await asyncio.gather(*tasks, return_exceptions=True)

        successful = []
        for result in fetched:
            if isinstance(result, ExtractedContent):
                successful.append(result)
            # Exceptions are silently ignored (logged in production)

        return successful

    async def _read_limited(self, response: httpx.Response) -> Optional[str]:
        """Read response content with size limit."""
        chunks = []
        total_size = 0

        async for chunk in response.aiter_bytes(chunk_size=8192):
            total_size += len(chunk)
            if total_size > self.max_content_size:
                break
            chunks.append(chunk)

        if not chunks:
            return None

        content = b''.join(chunks)
        try:
            return content.decode('utf-8', errors='ignore')
        except UnicodeDecodeError:
            return content.decode('latin-1', errors='ignore')

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
            self._semaphore = None