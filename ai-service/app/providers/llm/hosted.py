"""
Hosted LLM Provider - Phase 10
Placeholder for hosted inference (OpenAI, Anthropic, etc.).
Privacy note: Do not use for private user content without explicit consent.
"""
import os
import time
import httpx
from typing import Optional
from app.providers.llm.base import LLMProvider, LLMResponse


class HostedLLMProvider(LLMProvider):
    """
    Hosted LLM provider for OpenAI-compatible APIs.

    WARNING: This sends data to a third party.
    Only enable with explicit privacy policy and user consent.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self._base_url = base_url or os.getenv("HOSTED_LLM_BASE_URL", "https://api.openai.com/v1")
        self._model = model or os.getenv("HOSTED_LLM_MODEL", "gpt-4o-mini")
        self._api_key = api_key or os.getenv("HOSTED_LLM_API_KEY")
        self._client: Optional[httpx.AsyncClient] = None

        if not self._api_key:
            raise ValueError("HOSTED_LLM_API_KEY must be set for hosted provider")

    @property
    def name(self) -> str:
        return "hosted"

    @property
    def model_name(self) -> str:
        return self._model

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                timeout=60.0,
            )
        return self._client

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.1,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> LLMResponse:
        client = await self._get_client()

        payload = {
            "model": self._model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        start_time = time.perf_counter()

        response = await client.post(
            "/chat/completions",
            json=payload,
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()

        text = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        return LLMResponse(
            text=text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            model_name=self._model,
        )

    async def health_check(self) -> bool:
        if not self._api_key:
            return False
        try:
            client = await self._get_client()
            response = await client.get("/models", timeout=10.0)
            return response.status_code == 200
        except Exception:
            return False

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None