"""Alerts service — Phase 2 (CAP-shaped, adapted to the Alert model)."""

from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Alert, User, UserAlertPref
from app.schemas.alert import AlertCreateIn


async def list_alerts(db: AsyncSession, user: User) -> list[Alert]:
    now = datetime.now(timezone.utc)
    stmt = select(Alert).where((Alert.expires_at.is_(None)) | (Alert.expires_at > now))
    rows = (await db.scalars(stmt.order_by(Alert.created_at.desc()))).all()
    # geo-target: area == "*" or contains user's region
    region = user.department  # best available region proxy; citizens have None
    out = []
    for a in rows:
        if a.area == "*" or (
            region and region in [x.strip() for x in a.area.split(",")]
        ):
            out.append(a)
    return out


async def create_alert(db: AsyncSession, user: User, payload: AlertCreateIn) -> Alert:
    alert = Alert(
        event=payload.event,
        title=payload.title,
        body=payload.body,
        severity=payload.severity,
        urgency=payload.urgency,
        certainty=payload.certainty,
        area=payload.area,
        expires_at=payload.expires_at,
        published_by=user.id,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    # publish to redis channel
    try:
        import json

        from app.core.database import get_redis

        r = get_redis()
        await r.publish(
            "alerts",
            json.dumps(
                {
                    "type": "alert.created",
                    "data": {"id": alert.id, "title": alert.title},
                }
            ),
        )
    except Exception:
        pass
    return alert


async def list_prefs(db: AsyncSession, user: User) -> list[UserAlertPref]:
    rows = (
        await db.scalars(select(UserAlertPref).where(UserAlertPref.user_id == user.id))
    ).all()
    return list(rows)


async def upsert_pref(
    db: AsyncSession, user: User, region, category, enabled
) -> UserAlertPref:
    # find existing
    existing = await db.scalar(
        select(UserAlertPref).where(
            UserAlertPref.user_id == user.id,
            UserAlertPref.region == region,
            UserAlertPref.category == category,
        )
    )
    if existing:
        existing.enabled = enabled
        await db.commit()
        await db.refresh(existing)
        return existing
    pref = UserAlertPref(
        user_id=user.id, region=region, category=category, enabled=enabled
    )
    db.add(pref)
    await db.commit()
    await db.refresh(pref)
    return pref


async def delete_pref(db: AsyncSession, user: User, pref_id: str) -> None:
    pref = await db.get(UserAlertPref, pref_id)
    if pref is None or pref.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Preference not found"
        )
    await db.delete(pref)
    await db.commit()
