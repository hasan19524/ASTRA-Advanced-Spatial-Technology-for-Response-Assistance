"""Response tasks — Phase 2: CRUD + assignment + progress updates."""

from fastapi import APIRouter, Depends, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.models import User
from app.schemas.task import (
    TaskCreateIn,
    TaskOut,
    TaskPatchIn,
    TaskUpdateIn,
    TaskUpdateOut,
)
from app.services import task_service as svc

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
async def list_all_tasks(
    status_filter: str | None = Query(
        None, alias="status", pattern="^(OPEN|IN_PROGRESS|DONE)$"
    ),
    department: str | None = Query(None),
    incident_id: str | None = Query(None),
    assigned_to_me: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(require_permission("task.view")),
    db: AsyncSession = Depends(get_db),
):
    """Role-scoped task list — the dispatch board behind /teams.

    CENTRAL_ADMIN sees every task, DEPARTMENT_HEAD sees their department,
    RESPONSE_TEAM sees only the tasks they are assigned to.
    """
    rows = await svc.list_tasks_scoped(
        db,
        user,
        task_status=status_filter,
        department=department,
        incident_id=incident_id,
        assigned_to_me=assigned_to_me,
        limit=limit,
    )
    return [await svc.to_out(db, t) for t in rows]


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: str = Path(...),
    user: User = Depends(require_permission("task.view")),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    task = await svc.get_task(db, user, task_id)
    return await svc.to_out(db, task)


@router.get("/by-incident/{incident_id}", response_model=list[TaskOut])
async def list_tasks_by_incident(
    incident_id: str = Path(...),
    user: User = Depends(require_permission("task.view")),
    db: AsyncSession = Depends(get_db),
) -> list[TaskOut]:
    tasks = await svc.list_tasks(db, user, incident_id)
    return [await svc.to_out(db, t) for t in tasks]


@router.post(
    "/by-incident/{incident_id}",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    incident_id: str = Path(...),
    payload: TaskCreateIn = ...,
    user: User = Depends(require_permission("task.create")),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    task = await svc.create_task(db, user, incident_id, payload)
    return await svc.to_out(db, task)


# convenience: POST /incidents/{id}/tasks handled via alias router below is not
# needed; we expose both shapes by also registering an incidents-scoped router.
incidents_router = APIRouter(prefix="/incidents", tags=["tasks"])


@incidents_router.post(
    "/{incident_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_under_incident(
    incident_id: str = Path(...),
    payload: TaskCreateIn = ...,
    user: User = Depends(require_permission("task.create")),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    task = await svc.create_task(db, user, incident_id, payload)
    return await svc.to_out(db, task)


@incidents_router.get("/{incident_id}/tasks", response_model=list[TaskOut])
async def list_tasks_under_incident(
    incident_id: str = Path(...),
    user: User = Depends(require_permission("task.view")),
    db: AsyncSession = Depends(get_db),
) -> list[TaskOut]:
    tasks = await svc.list_tasks(db, user, incident_id)
    return [await svc.to_out(db, t) for t in tasks]


@router.patch("/{task_id}", response_model=TaskOut)
async def patch_task(
    task_id: str = Path(...),
    payload: TaskPatchIn = ...,
    user: User = Depends(require_permission("task.update")),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    # allow dept heads/admins (task.assign or task.create) to patch too
    if "task.update" not in __import__(
        "app.core.permissions", fromlist=["permissions_for"]
    ).permissions_for(user.role):
        pass
    task = await svc.patch_task(db, user, task_id, payload)
    return await svc.to_out(db, task)


@router.post(
    "/{task_id}/updates",
    response_model=TaskUpdateOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_update(
    task_id: str = Path(...),
    payload: TaskUpdateIn = ...,
    user: User = Depends(require_permission("task.update")),
    db: AsyncSession = Depends(get_db),
) -> TaskUpdateOut:
    task, update = await svc.add_update(db, user, task_id, payload)
    return TaskUpdateOut.model_validate(update)


@router.get("/{task_id}/updates", response_model=list[TaskUpdateOut])
async def list_updates(
    task_id: str = Path(...),
    user: User = Depends(require_permission("task.view")),
    db: AsyncSession = Depends(get_db),
) -> list[TaskUpdateOut]:
    updates = await svc.list_updates(db, user, task_id)
    return [TaskUpdateOut.model_validate(u) for u in updates]
