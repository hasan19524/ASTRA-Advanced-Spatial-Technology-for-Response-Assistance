"""User model — one role per account (AD-7)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Argon2 hash — salt is embedded in the string, never stored separately
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # CITIZEN | CENTRAL_ADMIN | DEPARTMENT_HEAD | RESPONSE_TEAM | VERIFICATION_OFFICER
    role: Mapped[str] = mapped_column(
        String(32), nullable=False, default="CITIZEN", index=True
    )
    department: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )  # for DEPARTMENT_HEAD / RESPONSE_TEAM
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
