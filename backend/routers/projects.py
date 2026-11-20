from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import delete, select, update

from models import ProjectRecord
from routers.auth import CurrentUser, DatabaseSession
from schemas.projects import Project, ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["Projetos"])


def project_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projeto não encontrado.")


@router.get("")
def list_projects(session: DatabaseSession, user: CurrentUser) -> list[Project]:
    statement = select(ProjectRecord).where(ProjectRecord.owner_id == user.id)
    records = session.scalars(statement.order_by(ProjectRecord.name, ProjectRecord.id))
    return [Project.model_validate(record) for record in records]


@router.get("/{project_id}")
def get_project(project_id: UUID, session: DatabaseSession, user: CurrentUser) -> Project:
    project = session.scalar(
        select(ProjectRecord).where(ProjectRecord.id == project_id, ProjectRecord.owner_id == user.id)
    )
    if project is None:
        raise project_not_found()
    return Project.model_validate(project)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, session: DatabaseSession, user: CurrentUser) -> Project:
    project = ProjectRecord(**payload.model_dump(), owner_id=user.id)
    session.add(project)
    session.commit()
    return Project.model_validate(project)


@router.put("/{project_id}")
def update_project(
    project_id: UUID, payload: ProjectUpdate, session: DatabaseSession, user: CurrentUser
) -> Project:
    statement = (
        update(ProjectRecord)
        .where(ProjectRecord.id == project_id, ProjectRecord.owner_id == user.id)
        .values(**payload.model_dump())
        .returning(ProjectRecord)
    )
    project = session.scalar(statement)
    if project is None:
        raise project_not_found()
    session.commit()
    return Project.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: UUID, session: DatabaseSession, user: CurrentUser) -> Response:
    statement = (
        delete(ProjectRecord)
        .where(ProjectRecord.id == project_id, ProjectRecord.owner_id == user.id)
        .returning(ProjectRecord.id)
    )
    if session.scalar(statement) is None:
        raise project_not_found()
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
