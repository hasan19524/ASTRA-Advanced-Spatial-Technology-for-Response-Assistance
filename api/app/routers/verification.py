"""Verification endpoints (Day 4, AD-23):

POST /incidents/{id}/verify     — officer marks VERIFIED or REJECTED
POST /incidents/{id}/reject     — officer marks REJECTED (reason required)
POST /incidents/{id}/reopen     — officer reopens REJECTED -> UNVERIFIED

Mounted with prefix /api/v1, and:

GET  /verification/queue        — officer queue, oldest first
  (separate router so the contract path stays /verification/queue)
"""

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.schemas.incident import IncidentPageOut, IncidentOut
from app.schemas.verification import (
    ReopenIn,
    VerificationDecisionOut,
    VerifyIn,
)
from app.services import incident_service as incident_svc
from app.services import verification_service as svc

router = APIRouter(prefix="/incidents", tags=["verification"])


async def _fetch_incident(incident_id: str, user, db: AsyncSession):
    incident = await incident_svc.get_visible_incident(db, user, incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found"
        )
    return incident


@router.post(
    "/{incident_id}/verify",
    response_model=VerificationDecisionOut,
    status_code=status.HTTP_200_OK,
)
async def verify(
    incident_id: str = Path(...),
    payload: VerifyIn = ...,  # body: {"verdict": "VERIFIED"|"REJECTED", "reason"?}
    user=Depends(require_permission("incident.verify")),
    db: AsyncSession = Depends(get_db),
) -> VerificationDecisionOut:
    """Officer verifies or rejects an incident. REJECTED requires a reason."""
    incident = await _fetch_incident(incident_id, user, db)
    return await svc.verify_incident(
        db, user, incident, payload.verdict, payload.reason
    )


@router.post(
    "/{incident_id}/reject",
    response_model=VerificationDecisionOut,
    status_code=status.HTTP_200_OK,
)
async def reject(
    incident_id: str = Path(...),
    payload: VerifyIn = ...,  # body: {"verdict": "REJECTED", "reason": "..."}
    user=Depends(require_permission("incident.verify")),
    db: AsyncSession = Depends(get_db),
) -> VerificationDecisionOut:
    """Convenience alias for verify with verdict=REJECTED (reason required)."""
    if payload.verdict != "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="/reject requires verdict=REJECTED",
        )
    incident = await _fetch_incident(incident_id, user, db)
    return await svc.verify_incident(db, user, incident, "REJECTED", payload.reason)


@router.post(
    "/{incident_id}/reopen",
    response_model=VerificationDecisionOut,
    status_code=status.HTTP_200_OK,
)
async def reopen(
    incident_id: str = Path(...),
    payload: ReopenIn = ...,  # body: {"reason": "..."}
    user=Depends(require_permission("incident.verify")),
    db: AsyncSession = Depends(get_db),
) -> VerificationDecisionOut:
    """Reopen a REJECTED incident back to UNVERIFIED (reason required)."""
    incident = await _fetch_incident(incident_id, user, db)
    return await svc.reopen_incident(db, user, incident, payload.reason)


# ---------------------------------------------------------------- queue
# Separate router: the contract path is GET /verification/queue (no /incidents).

queue_router = APIRouter(prefix="/verification", tags=["verification"])


@queue_router.get("/queue", response_model=IncidentPageOut)
async def queue(
    assessment: str | None = Query(None),
    min_age_minutes: int | None = Query(None, ge=0),
    urgency: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(require_permission("incident.verify")),
    db: AsyncSession = Depends(get_db),
) -> IncidentPageOut:
    """Officer queue: UNVERIFIED and REJECTED incidents, oldest first."""
    items, total, limit, offset = await svc.verification_queue(
        db,
        user,
        assessment=assessment,
        min_age_minutes=min_age_minutes,
        urgency=urgency,
        limit=limit,
        offset=offset,
    )
    counts = await incident_svc.report_counts(db, [item.id for item in items])
    page = [IncidentOut.model_validate(item) for item in items]
    for out in page:
        out.report_count = counts.get(out.id, 0)
    return IncidentPageOut(items=page, total=total, limit=limit, offset=offset)
