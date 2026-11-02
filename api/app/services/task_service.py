"""Response task service — Phase 2 (PL-7).

Task completion never writes `incidents.lifecycle` (vision.md §F / AD-14).
Transitions: OPEN -> IN_PROGRESS -> DONE, plus OPEN -> DONE direct.
Backwards (and DONE -> anything) -> InvariantError-equivalent 409.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Assignment, ResponseTask, TaskUpdate, User
from app.services import incident_service

TASK_TRANSITIONS: frozenset[tuple[str, str]] = frozenset(
    {
        ("OPEN", "IN_PROGRESS"),
        ("OPEN", "DONE"),
        ("IN_PROGRESS", "DONE"),
    }
)


def _refuse_illegal_transition(current: str, new: str) -> None:
    if current == new:
        return
    if (current, new) not in TASK_TRANSITIONS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"illegal task transition {current} -> {new}",
        )


def _in_scope(user: User, task: ResponseTask) -> bool:
    if user.role == "CENTRAL_ADMIN":
        return True
    if task.department != user.department:
        return False
    return True


async def _fetch_task(db: AsyncSession, user: User, task_id: str) -> ResponseTask:
    task = await db.get(ResponseTask, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not found"
        )
    if not _in_scope(user, task):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Not found"
        )
    # RESPONSE_TEAM may only touch tasks they are assigned to
    if user.role == "RESPONSE_TEAM":
        assigned = await db.scalar(
            select(func.count())
            .select_from(Assignment)
            .where(Assignment.task_id == task.id, Assignment.assignee_id == user.id)
        )
        if not assigned:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not assigned to this task",
            )
    return task


async def _to_out(db: AsyncSession, task: ResponseTask):
    from app.schemas.task import TaskOut

    rows = (
        await db.execute(
            select(Assignment.assignee_id, User.full_name)
            .join(User, User.id == Assignment.assignee_id)
            .where(Assignment.task_id == task.id)
        )
    ).all()
    return TaskOut(
        id=task.id,
        incident_id=task.incident_id,
        title=task.title,
        description=task.description,
        department=task.department,
        status=task.status,
        assignee_ids=[r[0] for r in rows],
        assignee_names=[r[1] for r in rows],
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def create_task(db, user, incident_id, payload) -> ResponseTask:
    incident = await incident_service.get_visible_incident(db, user, incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found"
        )
    department = payload.department or user.department
    if not department:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="department is required",
        )
    task = ResponseTask(
        incident_id=incident_id,
        title=payload.title,
        description=payload.description,
        department=department,
        status="OPEN",
    )
    db.add(task)
    await db.flush()
    for aid in payload.assignee_ids:
        assignee = await db.get(User, aid)
        if assignee is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found"
            )
        db.add(Assignment(task_id=task.id, assignee_id=aid, assigned_by=user.id))
    await db.commit()
    await db.refresh(task)
    await incident_service.publish_incident_updated_safe(incident) if hasattr(
        incident_service, "publish_incident_updated_safe"
    ) else None
    try:
        from app.services.map_ws import publish_incident_updated

        await publish_incident_updated(incident)
    except Exception:
        pass
    return task


async def list_tasks(db, user, incident_id) -> list[ResponseTask]:
    incident = await incident_service.get_visible_incident(db, user, incident_id)
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found"
        )
    rows = (
        await db.scalars(
            select(ResponseTask)
            .where(ResponseTask.incident_id == incident_id)
            .order_by(ResponseTask.created_at.asc())
        )
    ).all()
    # scope filter
    if user.role != "CENTRAL_ADMIN":
        rows = [t for t in rows if t.department == user.department]
    return list(rows)


async def get_task(db, user, task_id) -> ResponseTask:
    return await _fetch_task(db, user, task_id)


async def patch_task(db, user, task_id, payload) -> ResponseTask:
    task = await _fetch_task(db, user, task_id)
    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.department is not None:
        task.department = payload.department
    if payload.status is not None and payload.status != task.status:
        _refuse_illegal_transition(task.status, payload.status)
        task.status = payload.status
    await db.commit()
    await db.refresh(task)
    return task


async def add_update(db, user, task_id, payload) -> tuple[ResponseTask, TaskUpdate]:
    task = await _fetch_task(db, user, task_id)
    new_status = payload.status if payload.status is not None else task.status
    if new_status != task.status:
        _refuse_illegal_transition(task.status, new_status)
        task.status = new_status
    update = TaskUpdate(
        task_id=task.id,
        author_id=user.id,
        status=task.status,
        note=payload.note,
    )
    db.add(update)
    await db.commit()
    await db.refresh(task)
    await db.refresh(update)
    return task, update


async def to_out(db, task):
    return await _to_out(db, task)


async def list_updates(db, user, task_id) -> list[TaskUpdate]:
    task = await _fetch_task(db, user, task_id)
    rows = (
        await db.scalars(
            select(TaskUpdate)
            .where(TaskUpdate.task_id == task.id)
            .order_by(TaskUpdate.created_at.asc())
        )
    ).all()
    return list(rows)
