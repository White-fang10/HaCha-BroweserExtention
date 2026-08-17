"""
Health and Readiness Tests - Phase 8
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    """Create test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestHealthEndpoint:
    """Tests for /health endpoint."""

    async def test_health_returns_healthy(self, client):
        """Health endpoint should return healthy status."""
        response = await client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "hacha-ai-service"
        assert "version" in data

    async def test_health_includes_version(self, client):
        """Health response should include version."""
        response = await client.get("/health")
        data = response.json()
        assert data["version"] == "0.1.0"


class TestReadinessEndpoint:
    """Tests for /ready endpoint."""

    async def test_ready_returns_ready(self, client):
        """Readiness endpoint should return ready or degraded status.

        With Phase 10, readiness depends on LLM provider health.
        If local Ollama is not running, status will be 'degraded'.
        """
        response = await client.get("/ready")

        assert response.status_code == 200
        data = response.json()
        # Accept both ready and degraded (when LLM is not available)
        assert data["status"] in ("ready", "degraded")
        assert data["service"] == "hacha-ai-service"
        assert "version" in data

    async def test_ready_includes_version(self, client):
        """Readiness response should include version."""
        response = await client.get("/ready")
        data = response.json()
        assert data["version"] == "0.1.0"