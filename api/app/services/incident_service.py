"""Incident service — creation, evidence upload (AD-8), scoped reads.

Routers stay thin (AD-9); every query that decides *what a user may see*
builds its WHERE clause here from one predicate:

    may see RESTRICTED/HIDDEN rows  <=>  permission `incident.view_restricted`
    (= CENTRAL_ADMIN + VERIFICATION_OFFICER — decision, Day 3)

Everyone else simply never matches those rows (absence, never 403).
"""

import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy import and_, func, select, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    ALLOWED_IMAGE_TYPES,
    CATEGORIES,
    MAX_UPLOAD_BYTES,
    NCR_CENTER_LAT,
    NCR_CENTER_LON,
)
from app.core.permissions import permissions_for
from app.models import (
    Assessment,
    Incident,
    IncidentReport,
    User,
    VerificationEvent,
)
from app.services import assessment_backend, incident_state
from app.services.assessment_backend import AssessmentBackend
from app.services.map_ws import publish_incident_created

# AD-8: api/uploads/ (gitignored) — resolved from this file so it works both
# on the host venv and inside the container (/app/uploads).
UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"

_EXT_BY_TYPE = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def can_see_restricted(user: User) -> bool:
    return "incident.view_restricted" in permissions_for(user.role)


def _visible_to(user: User):
    """SQL predicate for every incident read (list AND detail)."""
    if can_see_restricted(user):
        return true()
    return and_(Incident.sensitivity == "PUBLIC", Incident.visibility != "HIDDEN")


async def save_evidence(file: UploadFile | None) -> str | None:
    """AD-8: validate + store one evidence photo, return its URL path.

    Client-declared content type + hard 5 MB cap; rejected uploads never
    touch the disk (422 with a readable detail — demo rule).
    """
    if file is None or not file.filename:
        return None
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Photo must be one of {sorted(ALLOWED_IMAGE_TYPES)}",
        )
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="Photo exceeds the 5 MB limit")
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{_EXT_BY_TYPE[file.content_type]}"
    (UPLOADS_DIR / name).write_bytes(data)
    return f"/uploads/{name}"


# --- duplicate grouping v1 (task 6, vision.md §D) -------------------------
DUPLICATE_WINDOW_MINUTES = 30
MIN_TOKEN_OVERLAP = 0.5


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{3,}", text.lower()))


def token_overlap(parent_text: str, submission_text: str) -> float:
    """Share of the submission's words already present in the parent —
    the parent is the older, longer-lived description of the same event."""
    parent, submission = _tokens(parent_text), _tokens(submission_text)
    if not submission:
        return 0.0
    return len(parent & submission) / len(submission)


async def find_duplicate_parent(
    db: AsyncSession,
    *,
    title: str,
    description: str | None,
    region: str | None,
    category: str | None = None,
) -> Incident | None:
    """The task-6 matcher: same region, ≤ 30 min old, ≥ 50% token overlap on
    title+description, parent not DEFINITELY_FALSE. Region-less submissions
    never match (nothing to compare), and DEFINITELY_FALSE parents never
    attract new reports (they are closed incidents)."""
    if not region:
        return None
    text = f"{title} {description or ''}"
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=DUPLICATE_WINDOW_MINUTES)
    clauses = [
        Incident.region == region,
        Incident.created_at >= cutoff,
        Incident.assessment_status != "DEFINITELY_FALSE",
        Incident.visibility.in_(("PUBLIC", "PUBLIC_UNVERIFIED")),
        Incident.sensitivity == "PUBLIC",
    ]
    if category is not None:
        clauses.append(Incident.category == category)
    candidates = (
        await db.scalars(
            select(Incident).where(*clauses).order_by(Incident.created_at.desc())
        )
    ).all()
    for candidate in candidates:
        parent_text = f"{candidate.title} {candidate.description or ''}"
        if token_overlap(parent_text, text) >= MIN_TOKEN_OVERLAP:
            return candidate
    return None


async def create_incident(
    db: AsyncSession,
    user: User,
    *,
    title: str,
    description: str,
    category: str,
    region: str | None,
    latitude: float | None,
    longitude: float | None,
    location_text: str | None,
    media_path: str | None,
    backend: AssessmentBackend | None = None,
) -> tuple[Incident, bool]:
    """One citizen submission → one incident + its first `incident_reports`
    row (vision.md §A/§D: reports are always retained under an incident),
    UNLESS it groups under a recent duplicate parent — then it is filed as
    an extra report on that parent and `(parent, True)` comes back (task 6).

    `backend` is an injected assessment backend (tests); production leaves it
    None so `get_assessment_backend()` decides (rules by default, LLM with
    automatic degradation — AD-24)."""
    if not title:
        raise HTTPException(status_code=422, detail="title is required")
    if category not in CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Unknown category: {category}")

    parent = await find_duplicate_parent(
        db, title=title, description=description, region=region, category=category
    )
    if parent is not None:
        db.add(
            IncidentReport(
                incident_id=parent.id,
                reporter_id=user.id,
                content=description or title,
                media_path=media_path,
                source="PHOTO" if media_path else "TEXT",
            )
        )
        await db.commit()  # §D: retained under the parent, no duplicate row
        await db.refresh(parent)
        return parent, True

    incident = Incident(
        title=title,
        description=description or None,
        category=category,
        region=region,
        # optional coords stand in with the NCR center (Day 6 adds map picking)
        latitude=latitude if latitude is not None else NCR_CENTER_LAT,
        longitude=longitude if longitude is not None else NCR_CENTER_LON,
        location_text=location_text,
        reported_by=user.id,
    )
    db.add(incident)
    await db.flush()  # incident.id needed by the report + assessment rows
    db.add(
        IncidentReport(
            incident_id=incident.id,
            reporter_id=user.id,
            content=description or title,
            media_path=media_path,
            source="PHOTO" if media_path else "TEXT",
        )
    )
    # task 4: pluggable assessment (AD-24) — the stub stays byte-identical;
    # get_assessment_backend() is the single seam (rules by default, LLM with
    # automatic degradation when the key is missing or the call fails).
    result = await (backend or assessment_backend.get_assessment_backend()).assess(
        title=title,
        description=description,
        region=region,
        reporter_email=user.email,
    )
    db.add(
        incident_state.apply_assessment(
            incident,
            result.outcome,
            backend=result.backend,
            reason=result.reason,
            confidence=result.confidence,
            model=result.model,
        )
    )
    await db.commit()
    await db.refresh(incident)
    # live map channel (task 5): fan-out only while PUBLIC_UNVERIFIED+PUBLIC
    # (a DEFINITELY_FALSE report is HIDDEN by now → publish is a no-op)
    await publish_incident_created(incident)
    return incident, False


async def report_counts(db: AsyncSession, incident_ids: list[str]) -> dict[str, int]:
    """One grouped query per page — never N+1."""
    if not incident_ids:
        return {}
    rows = await db.execute(
        select(IncidentReport.incident_id, func.count())
        .where(IncidentReport.incident_id.in_(incident_ids))
        .group_by(IncidentReport.incident_id)
    )
    return {incident_id: count for incident_id, count in rows.all()}


async def verification_events(
    db: AsyncSession, incident_id: str, can_see_restricted: bool
) -> list[dict]:
    """Append-only verification timeline for the detail page (AD-23).

    Citizens see action + timestamps only; `reason` and `officer` are
    stripped (not omitted — stable shape for the frontend).
    """
    rows = await db.execute(
        select(VerificationEvent, User.full_name)
        .join(User, User.id == VerificationEvent.officer_id)
        .where(VerificationEvent.incident_id == incident_id)
        .order_by(VerificationEvent.created_at.asc())
    )
    out = []
    for event, officer_name in rows.all():
        out.append(
            {
                "id": event.id,
                "action": event.action,
                "reason": event.reason if can_see_restricted else None,
                "officer": officer_name if can_see_restricted else None,
                "created_at": event.created_at,
            }
        )
    return out


async def list_incidents(
    db: AsyncSession,
    user: User,
    *,
    category: str | None,
    assessment: str | None,
    verification: str | None,
    region: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Incident], int, dict[str, int]]:
    clauses = [_visible_to(user)]
    if category:
        clauses.append(Incident.category == category)
    if assessment:
        clauses.append(Incident.assessment_status == assessment)
    if verification:
        clauses.append(Incident.verification == verification)
    if region:
        clauses.append(Incident.region == region)

    total = int(
        await db.scalar(select(func.count()).select_from(Incident).where(*clauses)) or 0
    )
    rows = (
        await db.scalars(
            select(Incident)
            .where(*clauses)
            .order_by(Incident.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    counts = await report_counts(db, [row.id for row in rows])
    return list(rows), total, counts


async def get_visible_incident(
    db: AsyncSession, user: User, incident_id: str
) -> Incident | None:
    """Detail read — same visibility predicate as the list, so an incident a
    user can't list also 404s by id (existence stays secret)."""
    return await db.scalar(
        select(Incident).where(Incident.id == incident_id, _visible_to(user))
    )


async def timeline(
    db: AsyncSession, incident_id: str
) -> tuple[list[IncidentReport], list[Assessment]]:
    """Reports + assessment history for the detail page, oldest first."""
    reports = list(
        (
            await db.scalars(
                select(IncidentReport)
                .where(IncidentReport.incident_id == incident_id)
                .order_by(IncidentReport.created_at.asc())
            )
        ).all()
    )
    assessments = list(
        (
            await db.scalars(
                select(Assessment)
                .where(Assessment.incident_id == incident_id)
                .order_by(Assessment.created_at.asc())
            )
        ).all()
    )
    return reports, assessments
