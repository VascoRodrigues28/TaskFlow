from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


class TaskCommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class TaskComment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_name: str
    body: str
    created_at: datetime
