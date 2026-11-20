from typing import Annotated, Literal

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


class TaskCreate(TaskUpdate):
    description: str = ""
    status: TaskStatus = "todo"
    priority: TaskPriority = "Média"


class Task(TaskUpdate):
    id: int
