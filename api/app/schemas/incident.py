"""Incident schemas — the Day 3 contract shared with web/ (frozen in both
task files): IncidentOut + detail with the assessment timeline, and the
list page wrapper.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.verification import VerificationEventOut


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    content: str
    source: str  # TEXT | PHOTO | VOICE (voice lands Day 7)
    media_path: str | None = None  # "/uploads/<file>" or None
    created_at: datetime
    # deliberately NO reporter identity — privacy (Day 3 contract)


class AssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    backend: str  # RULE | LLM | EVON
    outcome: str  # DEFINITELY_FALSE | MAYBE_TRUE
    confidence: float | None = None
    reason: str | None = None
    created_at: datetime


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None = None
    category: str
    region: str | None = None
    latitude: float
    longitude: float
    location_text: str | None = None
    # the five axes (architecture.md §3)
    sensitivity: str
    assessment_status: str
    visibility: str
    verification: str
    response_phase: str
    lifecycle: str
    report_count: int = 0  # filled by the router from incident_reports
    created_at: datetime
    updated_at: datetime


class IncidentCreatedOut(IncidentOut):
    """POST /incidents response — `grouped` tells the reporter their submission
    was filed under an existing parent incident instead of a new one (§D)."""

    grouped: bool = False


class IncidentDetailOut(IncidentOut):
    reports: list[ReportOut] = []
    assessments: list[AssessmentOut] = []  # the detail page timeline
    verification_events: list[VerificationEventOut] = []  # stripped for citizens


class IncidentPageOut(BaseModel):
    items: list[IncidentOut]
    total: int
    limit: int
    offset: int
