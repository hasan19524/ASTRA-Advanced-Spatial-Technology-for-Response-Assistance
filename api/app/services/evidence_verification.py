"""Evidence verification orchestrator (Phase 3).

Deterministic validation runs first; only PASS images reach the hosted
vision provider. Provider failures degrade honestly to an UNAVAILABLE
state — never fabricated data. Authenticity is never claimed as proven.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re

from app.schemas.evidence import EvidenceAnalysis
from app.services.image_validation import ImageQualityValidator
from app.services.vision_provider import (
    VisionProviderInterface,
    get_vision_provider,
)

logger = logging.getLogger(__name__)

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)

VALID_RELEVANCE = {"RELEVANT", "IRRELEVANT", "UNCERTAIN"}
VALID_CONSISTENCY = {"CONSISTENT", "INCONSISTENT", "UNCERTAIN"}
VALID_AUTHENTICITY = {"UNDETERMINED", "SUSPICIOUS", "POTENTIALLY_MANIPULATED"}


class EvidenceVerificationService:
    def __init__(
        self,
        vision_provider: VisionProviderInterface | None = None,
        validator: ImageQualityValidator | None = None,
    ) -> None:
        self.validator = validator or ImageQualityValidator()
        self.provider = (
            vision_provider if vision_provider is not None else get_vision_provider()
        )

    async def analyze(
        self,
        image_bytes: bytes,
        incident_description: str,
        category: str,
        content_type: str | None = None,
    ) -> EvidenceAnalysis:
        # 1. deterministic validation first — no API call on FAIL
        q = self.validator.validate(image_bytes, content_type=content_type)
        if q["quality"] == "FAIL":
            return EvidenceAnalysis(
                image_quality="FAIL",
                image_relevance="UNCERTAIN",
                detected_objects=[],
                incident_consistency="UNCERTAIN",
                authenticity_assessment="UNDETERMINED",
                confidence=0.0,
                explanation=(
                    "Image failed deterministic quality checks: "
                    + "; ".join(q.get("issues", []))
                ),
                human_review_required=True,
            )

        # 2. hosted vision provider, retry once on 5xx/timeout
        raw: str | None = None
        last_exc: Exception | None = None
        for attempt in range(2):
            try:
                raw = await self.provider.analyze(
                    image_bytes,
                    incident_description,
                    category,
                    content_type=content_type,
                )
                break
            except Exception as exc:
                last_exc = exc
                logger.warning(
                    "vision provider attempt %d failed: %s", attempt + 1, exc
                )
                if attempt == 0:
                    await asyncio.sleep(0.2)
                    continue
        if raw is None:
            return EvidenceAnalysis(
                image_quality="PASS",
                image_relevance="UNCERTAIN",
                detected_objects=[],
                incident_consistency="UNCERTAIN",
                authenticity_assessment="UNDETERMINED",
                confidence=0.0,
                explanation="Vision service unavailable: " + str(last_exc),
                human_review_required=True,
            )

        # 3. parse + validate against schema
        parsed = _parse_json(raw)
        if parsed is None:
            return EvidenceAnalysis(
                image_quality="PASS",
                image_relevance="UNCERTAIN",
                detected_objects=[],
                incident_consistency="UNCERTAIN",
                authenticity_assessment="UNDETERMINED",
                confidence=0.0,
                explanation="Vision service returned unparseable response.",
                human_review_required=True,
            )

        relevance = parsed.get("image_relevance", "UNCERTAIN")
        if relevance not in VALID_RELEVANCE:
            relevance = "UNCERTAIN"
        consistency = parsed.get("incident_consistency", "UNCERTAIN")
        if consistency not in VALID_CONSISTENCY:
            consistency = "UNCERTAIN"
        authenticity = parsed.get("authenticity_assessment", "UNDETERMINED")
        if authenticity not in VALID_AUTHENTICITY:
            authenticity = "UNDETERMINED"
        # never allow "AUTHENTIC"
        if str(authenticity).upper() == "AUTHENTIC":
            authenticity = "UNDETERMINED"

        detected = parsed.get("detected_objects", [])
        if not isinstance(detected, list):
            detected = []
        detected = [str(x) for x in detected]

        try:
            confidence = float(parsed.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
        confidence = max(0.0, min(1.0, confidence))

        explanation = parsed.get("explanation") or "No explanation provided."
        human_review = bool(parsed.get("human_review_required", True))

        return EvidenceAnalysis(
            image_quality="PASS",
            image_relevance=relevance,
            detected_objects=detected,
            incident_consistency=consistency,
            authenticity_assessment=authenticity,
            confidence=confidence,
            explanation=str(explanation),
            human_review_required=human_review,
        )


def _parse_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = _JSON_BLOCK.search(text or "")
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def get_evidence_service() -> EvidenceVerificationService:
    return EvidenceVerificationService()
