"""Incident core — the five independent axes (architecture.md §3).

assessment ≠ poll ≠ verification ≠ response: each is its own column, its own owner:
  assessment_status  AI-owned (set once, history kept in `assessments`)
  visibility         derived: HIDDEN iff assessment == DEFINITELY_FALSE
  verification       Verification Officer-owned (append-only `verification_events`)
  response_phase     Central Admin-owned
  lifecycle          Central Admin-only (nobody else may close)
Poll votes live in `poll_votes` and can NEVER write to `verification`.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # AD-15: 8 categories — Fire, Accident, Flood/Waterlogging, Structural collapse,
    # Medical emergency, Crime/Safety, Utility outage, Hazard/Other
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # AD-13: NCR region scoping (e.g. "South Delhi", "Gurugram", "Noida")
    region: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # AD-15 addendum: PUBLIC | RESTRICTED (RESTRICTED never reaches the public map)
    sensitivity: Mapped[str] = mapped_column(
        String(16), nullable=False, default="PUBLIC"
    )

    # --- the five axes (architecture.md §3) --------------------------------
    # UNASSESSED | DEFINITELY_FALSE | MAYBE_TRUE — AI-owned, set once
    assessment_status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="UNASSESSED", index=True
    )
    # HIDDEN | PUBLIC_UNVERIFIED — service invariant: HIDDEN iff DEFINITELY_FALSE
    visibility: Mapped[str] = mapped_column(
        String(24), nullable=False, default="PUBLIC_UNVERIFIED", index=True
    )
    # UNVERIFIED | VERIFIED | REJECTED — Verification Officer-owned
    verification: Mapped[str] = mapped_column(
        String(16), nullable=False, default="UNVERIFIED", index=True
    )
    # NONE | COORDINATING | ACTIVE | RESOLVED — Central Admin-owned
    response_phase: Mapped[str] = mapped_column(
        String(16), nullable=False, default="NONE"
    )
    # OPEN | CLOSED — Central Admin-only
    lifecycle: Mapped[str] = mapped_column(
        String(16), nullable=False, default="OPEN", index=True
    )

    # --- location (Delhi NCR, AD-13) ---------------------------------------
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    location_text: Mapped[str | None] = mapped_column(String(255), nullable=True)

    reported_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )


class IncidentReport(Base):
    """One citizen's report — an incident can gather several (duplicate grouping v1)."""

    __tablename__ = "incident_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("incidents.id"), nullable=False, index=True
    )
    reporter_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # AD-8: photo lives in api/uploads/, DB stores the path
    media_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # TEXT | PHOTO | VOICE (voice slot lands with Day 7 voice work)
    source: Mapped[str] = mapped_column(String(16), nullable=False, default="TEXT")
    sensitivity: Mapped[str] = mapped_column(
        String(16), nullable=False, default="PUBLIC"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


class Assessment(Base):
    """Append-only AI assessment history — timeline on the incident detail page."""

    __tablename__ = "assessments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("incidents.id"), nullable=False, index=True
    )
    backend: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # RULE | LLM | EVON
    outcome: Mapped[str] = mapped_column(String(24), nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


class PollVote(Base):
    """Public poll — AD-18: every public UNVERIFIED incident. Never touches
    `verification` (vision.md §3). One vote per user per incident."""

    __tablename__ = "poll_votes"
    __table_args__ = (UniqueConstraint("incident_id", "voter_id", name="uq_poll_vote"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("incidents.id"), nullable=False, index=True
    )
    voter_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    vote: Mapped[bool] = mapped_column(Boolean, nullable=False)  # True = genuine
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


class VerificationEvent(Base):
    """Append-only officer decisions — the only writer of `incidents.verification`."""

    __tablename__ = "verification_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("incidents.id"), nullable=False, index=True
    )
    officer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    # VERIFIED | REJECTED | REOPENED
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
