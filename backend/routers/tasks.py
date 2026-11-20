from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from database import get_session
from models import TaskRecord
from schemas.tasks import Task, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Tarefas"])
TaskId = Annotated[int, Path(gt=0)]

DatabaseSession = Annotated[Session, Depends(get_session)]


def task_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarefa não encontrada.")


@router.get("")
def list_tasks(session: DatabaseSession) -> list[Task]:
    records = session.scalars(select(TaskRecord).order_by(TaskRecord.id))
    return [Task.model_validate(record) for record in records]


@router.get("/{task_id}")
def get_task(task_id: TaskId, session: DatabaseSession) -> Task:
    task = session.get(TaskRecord, task_id)
    if task is None:
        raise task_not_found()
    return Task.model_validate(task)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, session: DatabaseSession) -> Task:
    task = TaskRecord(**payload.model_dump())
    session.add(task)
    session.commit()
    return Task.model_validate(task)


@router.put("/{task_id}")
def update_task(task_id: TaskId, payload: TaskUpdate, session: DatabaseSession) -> Task:
    statement = (
        update(TaskRecord)
        .where(TaskRecord.id == task_id)
        .values(**payload.model_dump())
        .returning(TaskRecord)
    )
    task = session.scalar(statement)
    if task is None:
        raise task_not_found()
    session.commit()
    return Task.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: TaskId, session: DatabaseSession) -> Response:
    statement = delete(TaskRecord).where(TaskRecord.id == task_id).returning(TaskRecord.id)
    if session.scalar(statement) is None:
        raise task_not_found()
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
