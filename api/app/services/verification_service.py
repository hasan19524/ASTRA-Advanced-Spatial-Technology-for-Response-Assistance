"""Verification axis: verify / reject / reopen + the officer queue
(Day 4, AD-23).

Every axis change goes through `incident_state.set_verification()` — the
single I5 gate — and the `VerificationEvent` row is written in the SAME
transaction. The map channel is published only after commit, so a subscriber
never sees an uncommitted flip.

A DEFINITELY_FALSE report is HIDDEN + CLOSED (settled) — verification does
not apply there (409).
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import URGENT_CATEGORIES
from app.models import Incident, User, VerificationEvent
from app.services import incident_state
from app.services.incident_service import _visible_to
from app.services.map_ws import publish_incident_updated

logger = logging.getLogger(__name__)

_VERDICT_TO_STATUS = {"VERIFIED": "VERIFIED", "REJECTED": "REJECTED"}


def _refuse_hidden(incident: Incident) -> None:
    if incident.visibility == "HIDDEN":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "verification does not apply — this report is "
                "DEFINITELY_FALSE (hidden and closed)"
            ),
        )


async def verify_incident(
    db: AsyncSession,
    user: User,
    incident: Incident,
    verdict: str,
    reason: str | None,
) -> dict:
    _refuse_hidden(incident)
    new_status = _VERDICT_TO_STATUS[verdict]
    try:
        incident_state.set_verification(incident, user, new_status)
    except incident_state.InvariantError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    db.add(
        VerificationEvent(
            incident_id=incident.id,
            officer_id=user.id,
            action=new_status,
            reason=reason,
        )
    )
    await db.commit()
    await db.refresh(incident)
    logger.info("incident %s %s by %s", incident.id, new_status, user.id)
    await publish_incident_updated(incident)
    return {
        "action": new_status,
        "reason": reason,
        "officer_id": user.id,
        "created_at": datetime.now(timezone.utc),
    }


async def reopen_incident(
    db: AsyncSession, user: User, incident: Incident, reason: str
) -> dict:
    _refuse_hidden(incident)
    try:
        incident_state.set_verification(incident, user, "UNVERIFIED")
    except incident_state.InvariantError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    db.add(
        VerificationEvent(
            incident_id=incident.id,
            officer_id=user.id,
            action="REOPENED",
            reason=reason,
        )
    )
    await db.commit()
    await db.refresh(incident)
    logger.info("incident %s REOPENED by %s", incident.id, user.id)
    await publish_incident_updated(incident)
    return {
        "action": "REOPENED",
        "reason": reason,
        "officer_id": user.id,
        "created_at": datetime.now(timezone.utc),
    }


async def verification_queue(
    db: AsyncSession,
    user: User,
    *,
    assessment: str | None = None,
    min_age_minutes: int | None = None,
    urgency: bool = False,
    limit: int = 20,
    offset: int = 0,
):
    """Officer queue: UNVERIFIED and REJECTED incidents, oldest first.

    `urgency=true` restricts to life-safety categories (URGENT_CATEGORIES).
    Visibility is applied server-side — officers see RESTRICTED rows too.
    """
    stmt = (
        select(Incident)
        .where(_visible_to(user))
        .where(Incident.verification.in_(("UNVERIFIED", "REJECTED")))
        .where(Incident.visibility != "HIDDEN")
    )
    if assessment:
        stmt = stmt.where(Incident.assessment_status == assessment)
    if min_age_minutes is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=min_age_minutes)
        stmt = stmt.where(Incident.created_at <= cutoff)
    if urgency:
        stmt = stmt.where(Incident.category.in_(URGENT_CATEGORIES))

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await db.execute(
        stmt.order_by(Incident.created_at.asc()).limit(limit).offset(offset)
    )
    items = rows.scalars().all()
    return items, int(total), limit, offset
