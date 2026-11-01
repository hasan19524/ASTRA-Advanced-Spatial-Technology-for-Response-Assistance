"""Incident coordination — Phase 2: close (PL-8) + response_phase (PL-9)."""

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.models import User
from app.schemas.incident import IncidentOut
from app.services import incident_service as isvc
from app.services import incident_state

router = APIRouter(prefix="/incidents", tags=["coordination"])


class PhaseIn(BaseModel):
    phase: str


class CloseIn(BaseModel):
    note: str | None = None


@router.post("/{incident_id}/phase", response_model=IncidentOut)
async def set_phase(
    incident_id: str = Path(...),
    payload: PhaseIn = ...,
    user: User = Depends(require_permission("incident.coordinate")),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident = await isvc.get_visible_incident(db, user, incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found"
        )
    try:
        incident_state.set_response_phase(incident, user, payload.phase)
    except incident_state.InvariantError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    await db.commit()
    await db.refresh(incident)
    try:
        from app.services.map_ws import publish_incident_updated

        await publish_incident_updated(incident)
    except Exception:
        pass
    return IncidentOut.model_validate(incident)


@router.post("/{incident_id}/close", response_model=IncidentOut)
async def close_incident(
    incident_id: str = Path(...),
    payload: CloseIn = ...,
    user: User = Depends(require_permission("incident.close")),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident = await isvc.get_visible_incident(db, user, incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found"
        )
    # PL-8: refuse if any task still open/in_progress
    from sqlalchemy import select

    from app.models import ResponseTask

    open_tasks = (
        await db.scalars(
            select(ResponseTask.id).where(
                ResponseTask.incident_id == incident_id,
                ResponseTask.status.in_(("OPEN", "IN_PROGRESS")),
            )
        )
    ).all()
    if open_tasks:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"open_task_ids": list(open_tasks)},
        )
    try:
        incident_state.set_lifecycle(incident, user, "CLOSED")
    except incident_state.InvariantError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    await db.commit()
    await db.refresh(incident)
    try:
        from app.services.map_ws import publish_incident_updated

        await publish_incident_updated(incident)
    except Exception:
        pass
    return IncidentOut.model_validate(incident)


@router.post("/{incident_id}/reopen", response_model=IncidentOut)
async def reopen_incident(
    incident_id: str = Path(...),
    user: User = Depends(require_permission("incident.close")),
    db: AsyncSession = Depends(get_db),
) -> IncidentOut:
    incident = await isvc.get_visible_incident(db, user, incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found"
        )
    try:
        incident_state.set_lifecycle(incident, user, "OPEN")
    except incident_state.InvariantError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    await db.commit()
    await db.refresh(incident)
    return IncidentOut.model_validate(incident)
