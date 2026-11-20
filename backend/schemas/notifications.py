from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

NotificationKind = Literal["task_added", "task_in_progress", "task_completed"]


class Notification(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: NotificationKind
    actor_email: str
    project_name: str
    task_title: str
    created_at: datetime
    read_at: datetime | None


class NotificationFeed(BaseModel):
    items: list[Notification]
    unread_count: int
