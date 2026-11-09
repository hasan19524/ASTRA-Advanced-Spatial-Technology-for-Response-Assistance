"""Organisation directory — real people and real department load.

The departments screen and the task-assignment picker used to show invented
numbers ("12 units", "Insp. Sharma"). Both now read from the database:

  * GET /api/v1/users       — the directory, role-scoped
  * GET /api/v1/departments — per-department head, personnel and task load

Scope (never a citizen, never another department unless you are the central
admin):

  CENTRAL_ADMIN   → every user / every department
  DEPARTMENT_HEAD → users of their own department / their own department
  RESPONSE_TEAM   → themselves / their own department (aggregates only)
  CITIZEN         → 403
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.core.permissions import permissions_for
from app.models import ResponseTask, User
from app.schemas.org import DepartmentOut, UserDirectoryOut

router = APIRouter(prefix="", tags=["org"])


def _scope_clause(user: User):
    """(clause, allowed_departments) for the caller's role."""
    if user.role == "CENTRAL_ADMIN":
        return None, None
    if user.role in ("DEPARTMENT_HEAD", "RESPONSE_TEAM"):
        if not user.department:
            return None, set()
        return User.department == user.department, {user.department}
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to view the organisation directory",
    )


@router.get("/users", response_model=list[UserDirectoryOut])
async def list_users(
    department: str | None = Query(None),
    role: str | None = Query(None),
    user: User = Depends(require_permission("task.view")),
    db: AsyncSession = Depends(get_db),
):
    """The people directory (task assignment, department roster)."""
    clause, _ = _scope_clause(user)
    stmt = select(User).where(User.is_active.is_(True))
    if clause is not None:
        stmt = stmt.where(clause)
    elif user.role != "CENTRAL_ADMIN":
        # a staff member without a department sees only themselves
        stmt = stmt.where(User.id == user.id)
    if department:
        if user.role != "CENTRAL_ADMIN" and department != user.department:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only list people in your own department",
            )
        stmt = stmt.where(User.department == department)
    if role:
        stmt = stmt.where(User.role == role)
    rows = (
        await db.scalars(stmt.order_by(User.department.asc(), User.full_name.asc()))
    ).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "department": u.department,
            "permissions": permissions_for(u.role),
        }
        for u in rows
    ]


@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(
    user: User = Depends(require_permission("task.view")),
    db: AsyncSession = Depends(get_db),
):
    """Every department with its real head, personnel count and task load."""
    clause, allowed = _scope_clause(user)

    stmt = select(
        User.department,
        func.count(User.id).label("personnel"),
    ).where(User.is_active.is_(True), User.department.is_not(None))
    if clause is not None:
        stmt = stmt.where(clause)
    stmt = stmt.group_by(User.department)
    counts = {row[0]: int(row[1]) for row in (await db.execute(stmt)).all()}

    heads_stmt = select(User).where(
        User.is_active.is_(True),
        User.role == "DEPARTMENT_HEAD",
        User.department.is_not(None),
    )
    if allowed is not None:
        heads_stmt = heads_stmt.where(User.department.in_(allowed))
    heads = {u.department: u for u in (await db.scalars(heads_stmt)).all()}

    task_stmt = select(ResponseTask.department, ResponseTask.status).where(
        ResponseTask.department.is_not(None)
    )
    if allowed is not None:
        task_stmt = task_stmt.where(ResponseTask.department.in_(allowed))
    open_tasks: dict[str, int] = {}
    total_tasks: dict[str, int] = {}
    for dept, task_status in (await db.execute(task_stmt)).all():
        total_tasks[dept] = total_tasks.get(dept, 0) + 1
        if task_status != "DONE":
            open_tasks[dept] = open_tasks.get(dept, 0) + 1

    names = sorted(set(counts) | set(heads) | set(total_tasks))
    return [
        {
            "name": name,
            "head_name": heads[name].full_name if name in heads else None,
            "head_email": heads[name].email if name in heads else None,
            "personnel_count": counts.get(name, 0),
            "open_tasks": open_tasks.get(name, 0),
            "total_tasks": total_tasks.get(name, 0),
        }
        for name in names
    ]
