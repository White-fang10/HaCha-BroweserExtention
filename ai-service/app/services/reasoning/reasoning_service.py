"""
Reasoning Service - Phase 10
Orchestrates RAG context building, LLM inference, and output validation.
"""
import json
import time
from typing import Optional
from app.schemas.evidence import EvidencePackage
from app.schemas.verdict import (
    LLMVerdictResponse,
    VerifiedVerdict,
    EvidenceReference,
    Verdict,
)
from app.services.rag.context_builder import ContextBuilder
from app.services.rag.prompt_builder import PromptBuilder
from app.services.reasoning.grounding_validator import GroundingValidator
from app.services.reasoning.verdict_validator import VerdictValidator
from app.providers.llm import LLMProvider, LLMResponse
from app.core.config import get_settings


class ReasoningService:
    """
    Main reasoning service that converts EvidencePackage to VerifiedVerdict.

    Pipeline:
    1. Build RAG context from evidence package
    2. Build protected prompt
    3. Call LLM with retries
    4. Parse and validate structured output
    5. Validate evidence IDs and grounding
    6. Apply confidence rules
    7. Apply verdict validation rules
    8. Return verified verdict
    """

    def __init__(
        self,
        llm_provider: LLMProvider,
        context_builder: Optional[ContextBuilder] = None,
        prompt_builder: Optional[PromptBuilder] = None,
        max_retries: Optional[int] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[float] = None,
    ):
        self.llm_provider = llm_provider
        self.settings = get_settings()

        # Use config values with fallbacks
        self.context_builder = context_builder or ContextBuilder(
            max_items=self.settings.rag_max_evidence_items,
            max_excerpt_chars=self.settings.rag_max_excerpt_chars,
            min_relevance=self.settings.rag_min_relevance,
        )
        self.prompt_builder = prompt_builder or PromptBuilder(max_retries=max_retries or self.settings.llm_max_retries)
        self.max_retries = max_retries or self.settings.llm_max_retries
        self.temperature = temperature or self.settings.llm_temperature
        self.max_tokens = max_tokens or self.settings.llm_max_tokens
        self.timeout_seconds = timeout_seconds or self.settings.llm_timeout_seconds

        # Validators
        self.grounding_validator = None  # Initialized per-request with package
        self.verdict_validator = None    # Initialized per-request with package

    async def reason(self, package: EvidencePackage) -> VerifiedVerdict:
        """
        Execute full reasoning pipeline on evidence package.

        Returns VerifiedVerdict with validated, grounded output.
        """
        start_time = time.perf_counter()

        # Initialize validators with package
        self.grounding_validator = GroundingValidator(package, self._build_evidence_references(package))
        self.verdict_validator = VerdictValidator(package)

        # Handle no-evidence cases early (no LLM call needed)
        if not package.evidence:
            return VerifiedVerdict(
                verdict=Verdict.UNVERIFIED,
                confidence=0.0,
                summary="No evidence available for this claim.",
                reasoning="The evidence retrieval pipeline returned no usable evidence.",
                evidence=[],
                model_name=self.llm_provider.model_name,
                total_latency_ms=0,
            )

        if package.retrieval_status.value in ("NO_RESULTS", "NO_USABLE_EVIDENCE", "WEAK_EVIDENCE"):
            return VerifiedVerdict(
                verdict=Verdict.UNVERIFIED,
                confidence=0.0,
                summary=f"Insufficient evidence: {package.retrieval_status.value}",
                reasoning=f"Retrieval status: {package.retrieval_status.value}. {len(package.evidence)} evidence items found but below quality threshold.",
                evidence=self._build_evidence_references(package),
                model_name=self.llm_provider.model_name,
                total_latency_ms=0,
            )

        # Build RAG context
        context = self.context_builder.build(package)

        # LLM inference with retries
        llm_response = await self._infer_with_retries(context)

        # Parse and validate structured output
        llm_verdict = self._parse_and_validate(llm_response.text)

        # Validate evidence IDs
        llm_verdict = self._validate_evidence_ids(llm_verdict, context)

        # Grounding validation
        is_grounded, grounding_warnings = self.grounding_validator.validate(llm_verdict)

        # Build evidence references for final output
        evidence_refs = self._build_evidence_references(package)

        # Apply confidence bounding
        final_confidence = self._apply_confidence_rules(
            llm_verdict.confidence,
            package,
            llm_verdict,
        )

        # Create preliminary verdict for final validation
        preliminary = VerifiedVerdict(
            verdict=llm_verdict.verdict,
            confidence=final_confidence,
            summary=llm_verdict.summary,
            reasoning=llm_verdict.reasoning,
            evidence=evidence_refs,
            model_name=self.llm_provider.model_name,
            input_tokens=llm_response.input_tokens,
            output_tokens=llm_response.output_tokens,
            total_latency_ms=int((time.perf_counter() - start_time) * 1000),
        )

        # Final verdict validation (business rules)
        validated_verdict, verdict_warnings = self.verdict_validator.validate(preliminary)

        # Combine warnings into reasoning if any
        all_warnings = grounding_warnings + verdict_warnings
        if all_warnings:
            warning_text = "\n".join([f"[VALIDATION] {w}" for w in all_warnings])
            validated_verdict.reasoning = f"{validated_verdict.reasoning}\n\n{warning_text}"

        total_latency = int((time.perf_counter() - start_time) * 1000)
        validated_verdict.total_latency_ms = total_latency

        return validated_verdict

    async def _infer_with_retries(self, context) -> LLMResponse:
        """Run LLM inference with retry logic for invalid output."""
        last_error = None

        for attempt in range(self.max_retries + 1):
            prompt = self.prompt_builder.build_prompt_for_attempt(context, attempt)

            try:
                response = await self.llm_provider.generate(
                    prompt=prompt,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                    timeout_seconds=self.timeout_seconds,
                )
                return response

            except Exception as e:
                last_error = e
                # Log error but continue to retry
                continue

        # All retries failed
        raise RuntimeError(f"LLM inference failed after {self.max_retries + 1} attempts: {last_error}")

    def _parse_and_validate(self, text: str) -> LLMVerdictResponse:
        """Parse JSON and validate against schema."""
        # Strip any markdown code fences
        cleaned = text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        # Parse JSON
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON output: {e}")

        # Validate with Pydantic
        try:
            verdict = LLMVerdictResponse(**data)
        except Exception as e:
            raise ValueError(f"Schema validation failed: {e}")

        return verdict

    def _validate_evidence_ids(
        self,
        verdict: LLMVerdictResponse,
        context,
    ) -> LLMVerdictResponse:
        """Validate that all cited evidence IDs exist in context."""
        valid_ids = {item.evidence_id for item in context.evidence}

        # Filter supporting evidence
        verdict.supporting_evidence = [
            eid for eid in verdict.supporting_evidence if eid in valid_ids
        ]

        # Filter contradicting evidence
        verdict.contradicting_evidence = [
            eid for eid in verdict.contradicting_evidence if eid in valid_ids
        ]

        # Filter contextual evidence
        verdict.contextual_evidence = [
            eid for eid in verdict.contextual_evidence if eid in valid_ids
        ]

        return verdict

    def _build_evidence_references(self, package: EvidencePackage) -> list[EvidenceReference]:
        """Build resolved evidence references from package."""
        refs = []
        for i, item in enumerate(package.evidence):
            refs.append(EvidenceReference(
                id=f"E{i+1}",
                direction=item.direction.value,
                excerpt=item.excerpt,
                source_title=item.source_title,
                publisher=item.publisher,
                source_url=str(item.source_url),
                published_at=item.published_at.isoformat() if item.published_at else None,
                relevance_score=item.relevance_score,
                authority_score=item.authority_score,
                recency_score=item.recency_score,
                source_type=item.source_type.value,
            ))
        return refs

    def _apply_confidence_rules(
        self,
        model_confidence: float,
        package: EvidencePackage,
        verdict: LLMVerdictResponse,
    ) -> float:
        """
        Apply evidence-aware confidence ceiling.

        The model's confidence is capped by evidence quality.
        """
        # Base ceiling from retrieval status
        status_ceilings = {
            "SUCCESS": 1.0,
            "CONFLICTING_EVIDENCE": 0.7,
            "WEAK_EVIDENCE": 0.4,
            "NO_USABLE_EVIDENCE": 0.1,
            "NO_RESULTS": 0.0,
            "PROVIDER_ERROR": 0.0,
            "TIMEOUT": 0.0,
        }
        ceiling = status_ceilings.get(package.retrieval_status.value, 0.5)

        # Adjust based on evidence quantity and quality
        if package.evidence:
            avg_relevance = sum(e.relevance_score for e in package.evidence) / len(package.evidence)
            avg_authority = sum(e.authority_score for e in package.evidence) / len(package.evidence)
            quality_factor = (avg_relevance + avg_authority) / 2
            ceiling *= quality_factor

        # Ensure minimum ceiling for any evidence
        if package.evidence and ceiling < 0.1:
            ceiling = 0.1

        # Final confidence is min of model confidence and evidence ceiling
        final = min(model_confidence, ceiling)

        # Bound to [0, 1]
        return max(0.0, min(1.0, final))