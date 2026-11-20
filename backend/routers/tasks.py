from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Response, status
from sqlalchemy import delete, select, update

from models import TaskRecord
from routers.auth import CurrentUser, DatabaseSession
from schemas.tasks import Task, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Tarefas"])
TaskId = Annotated[int, Path(gt=0)]

def task_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarefa não encontrada.")


@router.get("")
def list_tasks(session: DatabaseSession, user: CurrentUser) -> list[Task]:
    records = session.scalars(
        select(TaskRecord).where(TaskRecord.owner_id == user.id).order_by(TaskRecord.id)
    )
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
    task = TaskRecord(**payload.model_dump(), owner_id=user.id)
    session.add(task)
    session.commit()
    return Task.model_validate(task)


@router.put("/{task_id}")
def update_task(task_id: TaskId, payload: TaskUpdate, session: DatabaseSession, user: CurrentUser) -> Task:
    statement = (
        update(TaskRecord)
        .where(TaskRecord.id == task_id, TaskRecord.owner_id == user.id)
        .values(**payload.model_dump())
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
