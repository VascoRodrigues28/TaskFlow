from datetime import date
from re import fullmatch
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

TaskStatus = Literal["todo", "progress", "done"]
TaskPriority = Literal["Baixa", "Média", "Alta"]
TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: TaskTitle
    description: str
    priority: TaskPriority
    project_id: UUID | None = None
    due_date: date | None = None

    @field_validator("due_date", mode="before")
    @classmethod
    def validate_due_date(cls, value: object) -> object:
        if value is None or type(value) is date:
            return value
        if isinstance(value, str) and fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
            return value
        raise ValueError("Usa o formato AAAA-MM-DD para a data de entrega.")


class TaskCreate(TaskUpdate):
    description: str = ""
    priority: TaskPriority = "Média"


class TaskAssignmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assignee_id: UUID | None


class TaskCompletionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    completed: bool = Field(strict=True)


class Task(TaskUpdate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: TaskStatus
    assignee_id: UUID | None
    can_edit: bool = True
    is_owner: bool = False
