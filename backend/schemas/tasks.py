from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

TaskStatus = Literal["todo", "progress", "done"]
TaskPriority = Literal["Baixa", "Média", "Alta"]
TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: TaskTitle
    description: str
    status: TaskStatus
    priority: TaskPriority
    project_id: UUID | None = None


class TaskCreate(TaskUpdate):
    description: str = ""
    status: TaskStatus = "todo"
    priority: TaskPriority = "Média"


class Task(TaskUpdate):
    model_config = ConfigDict(from_attributes=True)

    id: int
