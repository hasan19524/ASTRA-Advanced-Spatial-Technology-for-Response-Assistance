"""Audit log read — Phase 2 (admin only)."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.models import AuditLog, User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs")
async def list_logs(
    actor_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    since: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_permission("audit.read")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if since:
        stmt = stmt.where(AuditLog.created_at >= since)
    stmt = stmt.limit(limit).offset(offset)
    rows = (await db.scalars(stmt)).all()
    return [
        {
            "id": r.id,
            "actor_id": r.actor_id,
            "actor_role": r.actor_role,
            "actor_label": r.actor_label,
            "action": r.action,
            "method": r.method,
            "path": r.path,
            "resource_id": r.resource_id,
            "status_code": r.status_code,
            "ip": r.ip,
            "created_at": r.created_at,
        }
        for r in rows
    ]
