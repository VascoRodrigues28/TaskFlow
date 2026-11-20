from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Response, status
from sqlalchemy import delete, select, update

from models import ProjectRecord, TaskRecord
from routers.auth import CurrentUser, DatabaseSession
from routers.projects import project_not_found
from schemas.tasks import Task, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Tarefas"])
TaskId = Annotated[int, Path(gt=0)]

def task_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarefa não encontrada.")


def require_project(session: DatabaseSession, project_id: UUID, owner_id: UUID, *, lock: bool = False):
    statement = select(ProjectRecord.id).where(
        ProjectRecord.id == project_id, ProjectRecord.owner_id == owner_id
    )
    if lock:
        statement = statement.with_for_update(read=True, key_share=True)
    if session.scalar(statement) is None:
        raise project_not_found()


@router.get("")
def list_tasks(session: DatabaseSession, user: CurrentUser, project_id: UUID | None = None) -> list[Task]:
    statement = select(TaskRecord).where(TaskRecord.owner_id == user.id)
    if project_id is not None:
        require_project(session, project_id, user.id)
        statement = statement.where(TaskRecord.project_id == project_id)
    records = session.scalars(statement.order_by(TaskRecord.id))
    return [Task.model_validate(record) for record in records]


@router.get("/{task_id}")
def get_task(task_id: TaskId, session: DatabaseSession, user: CurrentUser) -> Task:
    task = session.scalar(
        select(TaskRecord).where(TaskRecord.id == task_id, TaskRecord.owner_id == user.id)
    )
    if task is None:
        raise task_not_found()
    return Task.model_validate(task)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, session: DatabaseSession, user: CurrentUser) -> Task:
    if payload.project_id is not None:
        require_project(session, payload.project_id, user.id, lock=True)
    task = TaskRecord(**payload.model_dump(), owner_id=user.id)
    session.add(task)
    session.commit()
    return Task.model_validate(task)


@router.put("/{task_id}")
def update_task(task_id: TaskId, payload: TaskUpdate, session: DatabaseSession, user: CurrentUser) -> Task:
    if payload.project_id is not None:
        require_project(session, payload.project_id, user.id, lock=True)
    statement = (
        update(TaskRecord)
        .where(TaskRecord.id == task_id, TaskRecord.owner_id == user.id)
        .values(**payload.model_dump(exclude_unset=True))
        .returning(TaskRecord)
    )
    task = session.scalar(statement)
    if task is None:
        raise task_not_found()
    session.commit()
    return Task.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: TaskId, session: DatabaseSession, user: CurrentUser) -> Response:
    statement = (
        delete(TaskRecord)
        .where(TaskRecord.id == task_id, TaskRecord.owner_id == user.id)
        .returning(TaskRecord.id)
    )
    if session.scalar(statement) is None:
        raise task_not_found()
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
