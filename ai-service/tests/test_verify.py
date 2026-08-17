"""
Verification Endpoint Tests - Phase 10
"""
import hashlib
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from app.main import app
from app.schemas.verdict import VerifiedVerdict, Verdict, EvidenceReference
from app.schemas.evidence import EvidencePackage, RetrievalStatus
from app.services.verification_service import _verification_service as verification_service_singleton


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
    """Tests for response contract with Phase 10."""

    @pytest.mark.asyncio
    async def test_verify_returns_evidence_response(self, client, valid_claim_hash):
        """Verify endpoint should return Phase 10 verified verdict response."""
        # Reset singleton to ensure clean state
        import app.services.verification_service as vs_module
        vs_module._verification_service = None

        payload = {
            "claim": "Test claim",
            "claim_hash": valid_claim_hash,
            "language": "en",
            "request_id": "test-req-123",
        }
        headers = {"Authorization": "Bearer development-secret"}

        # Mock the verification service to return a known verdict
        mock_verdict = VerifiedVerdict(
            verdict=Verdict.UNVERIFIED,
            confidence=0.0,
            summary="Test summary",
            reasoning="Test reasoning",
            evidence=[],
            model_name="test-model",
            input_tokens=100,
            output_tokens=50,
            total_latency_ms=100,
        )

        # Also patch the LLM provider to return test-model
        with patch("app.api.routes.verify.get_verification_service") as mock_get_service, \
             patch.dict("os.environ", {"LLM_PROVIDER": "test"}):
            mock_service = AsyncMock()
            mock_service.verify.return_value = mock_verdict
            mock_get_service.return_value = mock_service

            response = await client.post("/verify", json=payload, headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "verdict" in data["data"]
        assert "confidence" in data["data"]
        assert isinstance(data["data"]["explanation"], str)
        assert isinstance(data["data"]["sources"], list)

        # Verify meta - Phase 10 includes model name from LLM
        assert data["meta"]["provider"] == "hacha-ai-service"
        # Model name comes from the mocked verification service
        assert data["meta"]["model"] == "test-model"
        assert data["meta"]["request_id"] == "test-req-123"
        assert "processing_time_ms" in data["meta"]

    @pytest.mark.asyncio
    async def test_verify_preserves_request_id(self, client, valid_claim_hash):
        """Response should preserve request_id from request."""
        payload = {
            "claim": "Test claim",
            "claim_hash": valid_claim_hash,
            "language": "en",
            "request_id": "unique-req-id-456",
        }
        headers = {"Authorization": "Bearer development-secret"}

        mock_verdict = VerifiedVerdict(
            verdict=Verdict.UNVERIFIED,
            confidence=0.0,
            summary="Test summary",
            reasoning="Test reasoning",
            evidence=[],
            model_name="test-model",
            total_latency_ms=100,
        )

        with patch("app.api.routes.verify.get_verification_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_service.verify.return_value = mock_verdict
            mock_get_service.return_value = mock_service

            response = await client.post("/verify", json=payload, headers=headers)

        data = response.json()
        assert data["meta"]["request_id"] == "unique-req-id-456"


class TestHealthEndpoints:
    """Tests for health and readiness endpoints."""

    async def test_health_endpoint(self, client):
        """Health endpoint should return healthy status."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "service" in data
        assert "version" in data

    async def test_ready_endpoint(self, client):
        """Readiness endpoint should check dependencies."""
        response = await client.get("/ready")
        # May be 200 (ready) or 503 (not ready) depending on provider status
        assert response.status_code in (200, 503)
        data = response.json()
        assert "status" in data
        assert "service" in data


class TestVerdictSchemas:
    """Tests for verdict schema validation."""

    def test_verdict_taxonomy_values(self):
        """Verify verdict taxonomy has expected values."""
        assert Verdict.SUPPORTED == "SUPPORTED"
        assert Verdict.FALSE == "FALSE"
        assert Verdict.MISLEADING == "MISLEADING"
        assert Verdict.UNVERIFIED == "UNVERIFIED"
        assert Verdict.AI_ERROR == "AI_ERROR"

    def test_confidence_bounds(self):
        """Verify confidence is bounded [0, 1]."""
        verdict = VerifiedVerdict(
            verdict=Verdict.SUPPORTED,
            confidence=0.5,
            summary="Test",
            reasoning="Test",
            evidence=[],
        )
        assert 0.0 <= verdict.confidence <= 1.0

        # Test clamping - validator should clamp values
        verdict2 = VerifiedVerdict(
            verdict=Verdict.SUPPORTED,
            confidence=1.5,  # Should be clamped to 1.0
            summary="Test",
            reasoning="Test",
            evidence=[],
        )
        assert verdict2.confidence == 1.0

        verdict3 = VerifiedVerdict(
            verdict=Verdict.SUPPORTED,
            confidence=-0.5,  # Should be clamped to 0.0
            summary="Test",
            reasoning="Test",
            evidence=[],
        )
        assert verdict3.confidence == 0.0

    def test_evidence_reference_structure(self):
        """Verify evidence reference has required fields."""
        ref = EvidenceReference(
            id="E1",
            direction="SUPPORTS",
            excerpt="Test excerpt",
            source_title="Test Source",
            source_url="https://example.com",
            relevance_score=0.9,
            authority_score=0.8,
            recency_score=0.7,
            source_type="PRIMARY_OFFICIAL",
        )
        assert ref.id == "E1"
        assert ref.direction == "SUPPORTS"
        assert ref.source_url == "https://example.com"