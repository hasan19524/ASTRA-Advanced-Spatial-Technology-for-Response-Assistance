"""Response coordination — parent incident + linked tasks with independent status.

CAD precedent (docs/research-existing-apps.md §2): several units, one incident,
each with its own lifecycle. Task completion never writes `incidents.lifecycle`.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ResponseTask(Base):
    __tablename__ = "response_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("incidents.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # AD-14's 7 departments own the task
    department: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # OPEN | IN_PROGRESS | DONE — its own axis, independent of the incident's lifecycle
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="OPEN", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )


class TaskUpdate(Base):
    """Progress notes from the response team — append-only."""

    __tablename__ = "task_updates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("response_tasks.id"), nullable=False, index=True
    )
    author_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False
    )  # OPEN|IN_PROGRESS|DONE
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )


class Assignment(Base):
    """Dept head assigns response-team members to a task (permission `task.assign`)."""

    __tablename__ = "assignments"
    __table_args__ = (UniqueConstraint("task_id", "assignee_id", name="uq_assignment"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("response_tasks.id"), nullable=False, index=True
    )
    assignee_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    assigned_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
