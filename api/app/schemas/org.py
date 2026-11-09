"""Organisation schemas — people directory and department rollup."""

from pydantic import BaseModel


class UserDirectoryOut(BaseModel):
    """A person as the directory shows them (no password hash, ever)."""

    id: str
    email: str
    full_name: str
    role: str
    department: str | None = None
    permissions: list[str] = []


class DepartmentOut(BaseModel):
    """A department with its real head, personnel count and task load."""

    name: str
    head_name: str | None = None
    head_email: str | None = None
    personnel_count: int = 0
    open_tasks: int = 0
    total_tasks: int = 0
