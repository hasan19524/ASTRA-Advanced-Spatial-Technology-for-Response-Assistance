"""Poll endpoints — GET /incidents/{id}/poll, POST /incidents/{id}/poll/vote
(AD-18 / Day 4: public poll on every PUBLIC_UNVERIFIED + sensitivity=PUBLIC +
MAYBE_TRUE incident)."""

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.models import Incident, User
from app.schemas.poll import PollOut, PollVoteIn
from app.services import incident_service as svc
from app.services import poll_service

router = APIRouter(prefix="/incidents", tags=["poll"])


async def _fetch_visible(incident_id: str, user: User, db: AsyncSession) -> Incident:
    result = await db.execute(
        select(Incident).where(Incident.id == incident_id).where(svc._visible_to(user))
    )
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found"
        )
    return incident


@router.get("/{incident_id}/poll", response_model=PollOut)
async def get_poll(
    incident_id: str = Path(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PollOut:
    """Current poll snapshot for one incident (eligible, my vote, counts)."""
    incident = await _fetch_visible(incident_id, user, db)
    state = await poll_service.poll_state(db, user, incident)
    return PollOut(**state)


@router.post(
    "/{incident_id}/poll/vote",
    response_model=PollOut,
    status_code=status.HTTP_200_OK,
)
async def vote_on_poll(
    incident_id: str = Path(...),
    payload: PollVoteIn = ...,  # body: {"vote": "genuine" | "fake"}
    user: User = Depends(require_permission("poll.vote")),
    db: AsyncSession = Depends(get_db),
) -> PollOut:
    """Cast one vote. One vote per user per incident (unique constraint)."""
    incident = await _fetch_visible(incident_id, user, db)
    try:
        state = await poll_service.cast_vote(
            db, user, incident, payload.vote == "genuine"
        )
    except poll_service.PollNotEligible as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.reason)
    return PollOut(**state)
