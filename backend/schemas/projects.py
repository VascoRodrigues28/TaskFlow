from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

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
