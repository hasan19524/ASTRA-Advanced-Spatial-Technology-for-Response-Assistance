"""Audit log — append-only record of every mutating request (vision.md §4, AD-9).

No UPDATE/DELETE endpoints exist for this table, ever. `actor_id` is stored as a
plain string (no FK) so history survives account changes — this table outlives users.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.user import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # who (no FK on purpose — append-only history must outlive accounts)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    actor_role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    actor_label: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # email captured on login/register (no token yet)
    # what
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(8), nullable=False)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # outcome
    status_code: Mapped[int] = mapped_column(Integer, nullable=False)
    # when / where
    request_id: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False, index=True
    )
