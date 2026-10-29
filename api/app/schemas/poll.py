"""Poll request/response schemas (Day 4, AD-18)."""

from pydantic import BaseModel, ConfigDict, Field


class PollVoteIn(BaseModel):
    """genuine = the hazard looks real; fake = prank / false report."""

    vote: str = Field(
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
