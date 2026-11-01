"""Response task schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TaskCreateIn(BaseModel):
    title: str
    description: str | None = None
    department: str | None = None  # defaults to creator's department
    assignee_ids: list[str] = []


class TaskPatchIn(BaseModel):
    title: str | None = None
    description: str | None = None
    department: str | None = None
    status: str | None = None


class TaskUpdateIn(BaseModel):
    status: str | None = None
    note: str | None = None


class TaskUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    author_id: str
    status: str
    note: str | None = None
    created_at: datetime


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_id: str
    title: str
    description: str | None = None
    department: str
    status: str  # OPEN | IN_PROGRESS | DONE
    assignee_ids: list[str] = []
    assignee_names: list[str] = []
    created_at: datetime
    updated_at: datetime
