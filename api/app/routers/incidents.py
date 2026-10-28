"""Incidents — report submission (vision.md §A) + scoped reads.

Read rule (decided Day 3, frozen in both task files): every list/detail needs
a token; rows with `sensitivity=RESTRICTED` or `visibility=HIDDEN` exist only
for roles holding `incident.view_restricted` — everyone else gets absence
from lists and **404** by id, never 403.
"""

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission
from app.models import User
from app.schemas.incident import (
    AssessmentOut,
    IncidentCreatedOut,
    IncidentDetailOut,
    IncidentOut,
    IncidentPageOut,
    ReportOut,
)
from app.services import incident_service as svc

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.post("", response_model=IncidentCreatedOut, status_code=status.HTTP_201_CREATED)
async def submit_report(
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    region: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    location_text: str | None = Form(None),
    photo: UploadFile | None = File(None),
    user: User = Depends(require_permission("report.create")),
    db: AsyncSession = Depends(get_db),
) -> IncidentCreatedOut:
    """Citizen report: text (+ optional evidence photo, AD-8) → one incident.

    Coordinates are optional — the NCR center stands in until Day 6 map
    pinning. `grouped: true` = the submission filed under a recent duplicate
    parent (task 6) and its axes are the parent's.
    """
    media_path = await svc.save_evidence(photo)
    incident, grouped = await svc.create_incident(
        db,
        user,
        title=title.strip(),
        description=description.strip(),
        category=category.strip(),
        region=region.strip() if region else None,
        latitude=latitude,
        longitude=longitude,
        location_text=location_text.strip() if location_text else None,
        media_path=media_path,
    )
    # grouped submissions return the PARENT's axes with the grown report_count
    out = IncidentCreatedOut.model_validate(incident)
    out.grouped = grouped
    out.report_count = (await svc.report_counts(db, [incident.id])).get(incident.id, 0)
    return out


@router.get("", response_model=IncidentPageOut)
async def list_incidents(
    category: str | None = Query(None),
    assessment: str | None = Query(None),
    verification: str | None = Query(None),
    region: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IncidentPageOut:
    """Paginated, filtered incident list — visibility applied server-side."""
    items, total, counts = await svc.list_incidents(
        db,
        user,
        category=category,
        assessment=assessment,
        verification=verification,
        region=region,
        limit=limit,
        offset=offset,
    )
    page = [IncidentOut.model_validate(item) for item in items]
    for out in page:
        out.report_count = counts.get(out.id, 0)
    return IncidentPageOut(items=page, total=total, limit=limit, offset=offset)


@router.get("/{incident_id}", response_model=IncidentDetailOut)
async def get_incident(
    incident_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> IncidentDetailOut:
    """Detail: incident + reports + assessment timeline (no reporter identity)."""
    incident = await svc.get_visible_incident(db, user, incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found"
        )
    reports, assessments = await svc.timeline(db, incident_id)
    detail = IncidentDetailOut.model_validate(incident)
    detail.reports = [ReportOut.model_validate(r) for r in reports]
    detail.assessments = [AssessmentOut.model_validate(a) for a in assessments]
    detail.report_count = len(reports)
    return detail
