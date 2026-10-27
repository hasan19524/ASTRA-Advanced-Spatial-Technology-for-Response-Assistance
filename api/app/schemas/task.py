"""Response task schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    incident_id: str
    title: str
    description: str | None = None
    department: str
    status: str  # OPEN | IN_PROGRESS | DONE
    created_at: datetime
    updated_at: datetime
