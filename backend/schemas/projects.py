from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints

ProjectName = Annotated[str, StringConstraints(min_length=1, max_length=120)]
ProjectDescription = Annotated[str, StringConstraints(max_length=2000)]


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: ProjectName
    description: ProjectDescription


class ProjectCreate(ProjectUpdate):
    description: ProjectDescription = ""


class Project(ProjectUpdate):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: Literal["host", "member"] = "host"


class InviteToProject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class PendingInvitation(BaseModel):
    id: UUID
    project_id: UUID
    project_name: str
