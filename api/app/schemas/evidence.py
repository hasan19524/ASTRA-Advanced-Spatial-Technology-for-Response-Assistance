"""Evidence analysis schema (Phase 3, image evidence intelligence).

The output is deliberately honest: authenticity is NEVER reported as proven.
The strongest statement the system can make is ``POTENTIALLY_MANIPULATED``;
``UNDETERMINED`` is the default.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EvidenceAnalysis(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    image_quality: Literal["PASS", "FAIL"]
    image_relevance: Literal["RELEVANT", "IRRELEVANT", "UNCERTAIN"]
    detected_objects: list[str] = Field(default_factory=list)
    incident_consistency: Literal["CONSISTENT", "INCONSISTENT", "UNCERTAIN"]
    authenticity_assessment: Literal[
        "UNDETERMINED", "SUSPICIOUS", "POTENTIALLY_MANIPULATED"
    ]
    confidence: float = Field(ge=0.0, le=1.0)
    explanation: str
    human_review_required: bool
