"""
Local LLM Provider - Phase 10
Local inference via Ollama or compatible OpenAI-compatible API.
"""
import os
import time
import httpx
from typing import Optional
from app.providers.llm.base import LLMProvider, LLMResponse


class LocalLLMProvider(LLMProvider):
    """
    Local LLM provider using Ollama or OpenAI-compatible API.

    Supports:
    - Ollama (default): http://localhost:11434
    - vLLM OpenAI-compatible endpoint
    - Any OpenAI-compatible local inference server
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self._base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self._model = model or os.getenv("OLLAMA_MODEL", "llama3.1:8b")
        self._api_key = api_key or os.getenv("OLLAMA_API_KEY")
        self._client: Optional[httpx.AsyncClient] = None
        self._warm = False

    @property
    def name(self) -> str:
        return "local"

    @property
    def model_name(self) -> str:
        return self._model

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            headers = {"Content-Type": "application/json"}
            if self._api_key:
                headers["Authorization"] = f"Bearer {self._api_key}"
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers=headers,
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

        # Use Ollama's /api/generate endpoint (native) or /v1/completions (OpenAI-compat)
        # Try /v1/chat/completions first (OpenAI-compatible), fallback to /api/generate
        start_time = time.perf_counter()

        # OpenAI-compatible chat completions
        payload = {
            "model": self._model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        try:
            response = await client.post(
                "/v1/chat/completions",
                json=payload,
                timeout=timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()

            text = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)

        except httpx.HTTPError:
            # Fallback to Ollama native /api/generate
            native_payload = {
                "model": self._model,
                "prompt": prompt,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": False,
            }
            response = await client.post(
                "/api/generate",
                json=native_payload,
                timeout=timeout_seconds,
            )
            response.raise_for_status()
            data = response.json()

            text = data.get("response", "")
            # Ollama native doesn't always return token counts
            input_tokens = len(prompt) // 4
            output_tokens = len(text) // 4

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        return LLMResponse(
            text=text,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            model_name=self._model,
        )

    async def health_check(self) -> bool:
        try:
            client = await self._get_client()
            # Check if model is available
            response = await client.get("/api/tags", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return any(self._model in m for m in models)
            return False
        except Exception:
            return False

    async def warm_up(self) -> bool:
        """Warm up the model with a tiny test generation."""
        try:
            result = await self.generate(
                prompt="Test.",
                temperature=0.0,
                max_tokens=5,
                timeout_seconds=10.0,
            )
            self._warm = True
            return True
        except Exception:
            return False

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None