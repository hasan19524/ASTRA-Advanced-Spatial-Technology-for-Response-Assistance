"""Poll request/response schemas (Day 4, AD-18)."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PollVoteIn(BaseModel):
    """genuine = the hazard looks real; fake = prank / false report.

    `Literal` so a malformed vote ("yes", "banana") is a 422, never a
    silently-recorded "fake" vote (audit finding: free-form str let any
    non-"genuine" string count as fake).
    """

    vote: Literal["genuine", "fake"] = Field(
        ...,
        description="'genuine' or 'fake'",
    )


class PollOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    eligible: bool
    reason: str | None = None
    my_vote: str | None = None
    genuine: int = 0
    fake: int = 0
    percent_genuine: float = 0.0
