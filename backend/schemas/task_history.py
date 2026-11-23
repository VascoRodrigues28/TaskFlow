from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

HistoryAction = Literal["created", "edited", "assigned", "unassigned", "completed", "reopened"]


class TaskHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: HistoryAction
    actor_name: str
    assignee_name: str | None
    created_at: datetime
