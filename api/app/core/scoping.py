"""Object-level authorization (vision.md §4).

`require_permission` answers "may this ROLE do this ACTION?"
`assert_in_scope`  answers "may this user touch THIS object?"

Out-of-scope reads answer **404, not 403** — a 403 would confirm the object
exists, leaking the shape of other departments' work.
"""

from fastapi import HTTPException, status

from app.models import User


def assert_in_scope(user: User, obj: object) -> None:
    """Raise 404 unless `user` may see `obj`.

    Rules (the object is scoped by its `department` attribute, if it has one):
      * CENTRAL_ADMIN            — everything (cross-department coordination is their job)
      * DEPARTMENT_HEAD / TEAM   — own department only
      * anyone else              — denied (CITIZEN never reaches dept-scoped objects
                                    anyway: the permission gate stops them first)
    Objects without a `department` attribute are not dept-scoped → allowed
    once the permission gate has passed.
    """
    if user.role == "CENTRAL_ADMIN":
        return

    department = getattr(obj, "department", None)
    if department is None:
        return

    if (
        user.role in {"DEPARTMENT_HEAD", "RESPONSE_TEAM"}
        and user.department == department
    ):
        return

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
