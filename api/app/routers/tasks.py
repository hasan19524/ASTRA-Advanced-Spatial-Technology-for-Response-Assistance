"""Response tasks — Day 2 slice: a read endpoint that proves RBAC + object scoping.

Day 5 adds CRUD/assignment; today `GET /tasks/{id}` exists so the scope contract
is testable: right department 200, wrong department 404, missing permission 403.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.core.scoping import assert_in_scope
from app.models import ResponseTask, User
from app.schemas.task import TaskOut

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: str,
    user: User = Depends(require_permission("task.view")),
    db: AsyncSession = Depends(get_db),
) -> TaskOut:
    """Fetch one task — role gate first, object scope second."""
    task = await db.get(ResponseTask, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Task not found"
        )
    assert_in_scope(user, task)  # 404 when it belongs to another department
    return TaskOut.model_validate(task)
