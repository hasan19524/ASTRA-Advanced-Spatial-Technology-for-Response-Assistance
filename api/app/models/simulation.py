"""Simulation tables — AD-3: dedicated `sim_*` tables with ZERO foreign keys into
live tables. Only app/services/simulation.py may write here.

That structural isolation is the proof that hypothetical events never modify live
state — if a demo ever showed simulated data on a live dashboard, the schema itself
would witness that no FK or row was shared.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SimRun(Base):
    __tablename__ = "sim_runs"  # sim_* prefix per AD-3 (no FKs — see module docstring)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # PUBLIC | OPERATIONAL (public = anyone with simulation.public)
    mode: Mapped[str] = mapped_column(String(16), nullable=False, default="PUBLIC")
    scenario: Mapped[str] = mapped_column(String(64), nullable=False)
    params: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON blob
    # PENDING | RUNNING | DONE | FAILED
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    # Impact footprint + resource estimates (HAZUS-lite) — JSON, no FK anywhere
    summary: Mapped[str | None] = mapped_column(JSON, nullable=True)
    # Plain strings, NOT foreign keys — AD-3 forbids FKs into live tables
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
