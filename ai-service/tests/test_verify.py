"""
Verification Endpoint Tests - Phase 8
"""
import hashlib
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    """Create test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def valid_claim_hash():
    """Generate a valid 64-char SHA-256 hash."""
    return hashlib.sha256(b"test claim").hexdigest()


class TestVerifyEndpointAuth:
    """Tests for authentication on /verify endpoint."""

    async def test_verify_without_token_returns_422(self, client):
        """Verify endpoint should reject requests without token (missing required header)."""
        claim_hash = hashlib.sha256(b"test").hexdigest()
        payload = {
            "claim": "Test claim",
            "claim_hash": claim_hash,
            "language": "en",
            "request_id": "test-req-123",
        }
        response = await client.post("/verify", json=payload)
        # FastAPI returns 422 for missing required Header parameter
        assert response.status_code == 422

    async def test_verify_with_invalid_token_returns_403(self, client):
        """Verify endpoint should reject invalid tokens."""
        claim_hash = hashlib.sha256(b"test").hexdigest()
        payload = {
            "claim": "Test claim",
            "claim_hash": claim_hash,
            "language": "en",
            "request_id": "test-req-123",
        }
        headers = {"Authorization": "Bearer wrong-token"}
        response = await client.post("/verify", json=payload, headers=headers)
        assert response.status_code == 403

    async def test_verify_with_valid_token_accepts(self, client):
        """Verify endpoint should accept valid token."""
        claim_hash = hashlib.sha256(b"test").hexdigest()
        payload = {
            "claim": "Test claim",
            "claim_hash": claim_hash,
            "language": "en",
            "request_id": "test-req-123",
        }
        headers = {"Authorization": "Bearer development-secret"}
        response = await client.post("/verify", json=payload, headers=headers)
        assert response.status_code == 200


class TestVerifyEndpointValidation:
    """Tests for request validation."""

    async def test_verify_rejects_short_claim(self, client):
        """Claim must have minimum length."""
        claim_hash = hashlib.sha256(b"").hexdigest()
        payload = {
            "claim": "",
            "claim_hash": claim_hash,
            "language": "en",
            "request_id": "test-req-123",
        }
        headers = {"Authorization": "Bearer development-secret"}
        response = await client.post("/verify", json=payload, headers=headers)
        assert response.status_code == 422

    async def test_verify_rejects_invalid_hash_format(self, client):
        """Claim hash must be 64-char hex."""
        payload = {
            "claim": "Test claim",
            "claim_hash": "not-a-valid-hash",
            "language": "en",
            "request_id": "test-req-123",
        }
        headers = {"Authorization": "Bearer development-secret"}
        response = await client.post("/verify", json=payload, headers=headers)
        assert response.status_code == 422

    async def test_verify_rejects_unsupported_language(self, client):
        """Language must be in supported set."""
        claim_hash = hashlib.sha256(b"test").hexdigest()
        payload = {
            "claim": "Test claim",
            "claim_hash": claim_hash,
            "language": "xx",
            "request_id": "test-req-123",
        }
        headers = {"Authorization": "Bearer development-secret"}
        response = await client.post("/verify", json=payload, headers=headers)
        assert response.status_code == 422


class TestVerifyEndpointResponse:
    """Tests for stub response contract."""

    async def test_verify_returns_stub_response(self, client):
        """Verify endpoint should return Phase 8 stub response."""
        claim_hash = hashlib.sha256(b"test claim").hexdigest()
        payload = {
            "claim": "Test claim",
            "claim_hash": claim_hash,
            "language": "en",
            "request_id": "test-req-123",
        }
        headers = {"Authorization": "Bearer development-secret"}
        response = await client.post("/verify", json=payload, headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify data structure
        assert data["data"]["verdict"] == "UNVERIFIED"
        assert data["data"]["confidence"] == 0.0
        assert isinstance(data["data"]["explanation"], str)
        assert data["data"]["sources"] == []

        # Verify meta
        assert data["meta"]["provider"] == "hacha-ai-service"
        assert data["meta"]["model"] is None
        assert data["meta"]["request_id"] == "test-req-123"
        assert "processing_time_ms" in data["meta"]

    async def test_verify_preserves_request_id(self, client):
        """Response should preserve request_id from request."""
        claim_hash = hashlib.sha256(b"test claim").hexdigest()
        payload = {
            "claim": "Test claim",
            "claim_hash": claim_hash,
            "language": "en",
            "request_id": "unique-req-id-456",
        }
        headers = {"Authorization": "Bearer development-secret"}
        response = await client.post("/verify", json=payload, headers=headers)

        data = response.json()
        assert data["meta"]["request_id"] == "unique-req-id-456"