"""Public poll service (AD-18 / Day 4): eligibility, vote, counts.

One vote per user per incident (`uq_poll_vote`) — duplicates are refused by
the unique constraint, never by a check-then-insert race.
"""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import hit
from app.models import Incident, PollVote, User
from app.services import incident_state

logger = logging.getLogger(__name__)


class PollNotEligible(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _ineligible_reason(incident: Incident) -> str:
    if incident.sensitivity != "PUBLIC":
        return (
            f"sensitivity={incident.sensitivity} — RESTRICTED reports are not "
            "open to public voting"
        )
    if incident.visibility != "PUBLIC_UNVERIFIED":
        return (
            f"visibility={incident.visibility} — polls are open only for "
            "PUBLIC_UNVERIFIED reports"
        )
    if incident.assessment_status != "MAYBE_TRUE":
        return (
            f"assessment={incident.assessment_status} — only MAYBE_TRUE reports "
            "are open to public voting"
        )
    return "incident is not open to public voting"


async def poll_state(db: AsyncSession, user: User, incident: Incident) -> dict:
    """Snapshot: eligibility + my vote + running counts."""
    eligible = incident_state.poll_eligible(incident)
    reason = None if eligible else _ineligible_reason(incident)

    my_vote = await db.scalar(
        select(PollVote.vote).where(
            PollVote.incident_id == incident.id, PollVote.voter_id == user.id
        )
    )
    rows = await db.execute(
        select(PollVote.vote, func.count())
        .where(PollVote.incident_id == incident.id)
        .group_by(PollVote.vote)
    )
    counts = {True: 0, False: 0}
    for vote, count in rows.all():
        counts[bool(vote)] = int(count)
    total = counts[True] + counts[False]

    return {
        "eligible": eligible,
        "reason": reason,
        "my_vote": (
            "genuine" if my_vote is True else ("fake" if my_vote is False else None)
        ),
        "genuine": counts[True],
        "fake": counts[False],
        "percent_genuine": round(counts[True] / total * 100, 1) if total else 0.0,
    }


async def cast_vote(
    db: AsyncSession, user: User, incident: Incident, vote: bool
) -> dict:
    """Cast one vote. Race-safe: the unique constraint is the source of truth."""
    if not incident_state.poll_eligible(incident):
        raise PollNotEligible(_ineligible_reason(incident))

    key = f"ratelimit:poll:{user.id}"
    if not await hit(key, settings.poll_rate_limit, settings.poll_rate_window_seconds):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Rate limit exceeded — max {settings.poll_rate_limit} votes per "
                f"{settings.poll_rate_window_seconds}s per user; try again later"
            ),
        )

    db.add(PollVote(incident_id=incident.id, voter_id=user.id, vote=vote))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already voted on this incident",
        )
    return await poll_state(db, user, incident)
