"""Verification request/response schemas (Day 4, AD-23).

Verification axis: UNVERIFIED -> VERIFIED|REJECTED, REJECTED -> UNVERIFIED
(reopen). VERIFIED is terminal; REJECTED->VERIFIED directly is refused —
that must be two auditable events.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator


class VerifyIn(BaseModel):
    verdict: Literal["VERIFIED", "REJECTED"]
    reason: str | None = None

    @model_validator(mode="after")
    def _reject_requires_reason(self) -> "VerifyIn":
        if self.verdict == "REJECTED" and not self.reason:
            raise ValueError("reason is required when verdict is REJECTED")
        return self


class ReopenIn(BaseModel):
    reason: str  # AD-23: reopening a rejected incident always needs a reason


class VerificationDecisionOut(BaseModel):
    action: str  # VERIFIED | REJECTED | REOPENED
    reason: str | None = None
    officer_id: str
    created_at: datetime


class VerificationEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    action: str  # VERIFIED | REJECTED | REOPENED
    reason: str | None = None
    officer: str | None = None  # officer display name — null for citizens
    created_at: datetime
