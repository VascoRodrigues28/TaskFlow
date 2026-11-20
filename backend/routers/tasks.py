from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Response, status
from sqlalchemy import delete, or_, select

from models import ProjectRecord, TaskRecord
from routers.auth import CurrentUser, DatabaseSession
from routers.projects import project_access, project_not_found
from schemas.tasks import Task, TaskCreate, TaskStatusUpdate, TaskUpdate
from task_activity import record_task_activity

router = APIRouter(prefix="/tasks", tags=["Tarefas"])
TaskId = Annotated[int, Path(gt=0)]

def task_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarefa não encontrada.")


def require_project(session: DatabaseSession, project_id: UUID, user_id: UUID, *, lock: bool = False):
    statement = select(ProjectRecord.id).where(
        ProjectRecord.id == project_id, project_access(user_id)
    )
    if lock:
        statement = statement.with_for_update(read=True, key_share=True)
    if session.scalar(statement) is None:
        raise project_not_found()


def task_access(user_id: UUID):
    return or_(
        TaskRecord.owner_id == user_id,
        TaskRecord.project_id.in_(select(ProjectRecord.id).where(project_access(user_id))),
    )


def task_response(task: TaskRecord, user_id: UUID) -> Task:
    return Task.model_validate(task).model_copy(update={"can_edit": task.owner_id == user_id})


def notify_status_change(
    session: DatabaseSession, task: TaskRecord, user: CurrentUser, previous_status: str
) -> None:
    if task.status == previous_status:
        return
    if task.status == "progress":
        record_task_activity(session, task, user, "task_in_progress")
    elif task.status == "done":
        record_task_activity(session, task, user, "task_completed")


@router.get("")
def list_tasks(session: DatabaseSession, user: CurrentUser, project_id: UUID | None = None) -> list[Task]:
    statement = select(TaskRecord).where(task_access(user.id))
    if project_id is not None:
        require_project(session, project_id, user.id)
        statement = statement.where(TaskRecord.project_id == project_id)
    records = session.scalars(statement.order_by(TaskRecord.id))
    return [task_response(record, user.id) for record in records]


@router.get("/{task_id}")
def get_task(task_id: TaskId, session: DatabaseSession, user: CurrentUser) -> Task:
    task = session.scalar(
        select(TaskRecord).where(TaskRecord.id == task_id, task_access(user.id))
    )
    if task is None:
        raise task_not_found()
    return task_response(task, user.id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, session: DatabaseSession, user: CurrentUser) -> Task:
    if payload.project_id is not None:
        require_project(session, payload.project_id, user.id, lock=True)
    task = TaskRecord(**payload.model_dump(), owner_id=user.id)
    session.add(task)
    record_task_activity(session, task, user, "task_added")
    session.commit()
    return Task.model_validate(task)


@router.put("/{task_id}")
def update_task(task_id: TaskId, payload: TaskUpdate, session: DatabaseSession, user: CurrentUser) -> Task:
    if payload.project_id is not None:
        require_project(session, payload.project_id, user.id, lock=True)
    task = session.scalar(
        select(TaskRecord)
        .where(TaskRecord.id == task_id, TaskRecord.owner_id == user.id)
        .with_for_update()
    )
    if task is None:
        raise task_not_found()
    previous_project_id, previous_status = task.project_id, task.status
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    if task.project_id != previous_project_id:
        record_task_activity(session, task, user, "task_added")
    else:
        notify_status_change(session, task, user, previous_status)
    session.commit()
    return Task.model_validate(task)


@router.patch("/{task_id}/status")
def update_task_status(
    task_id: TaskId, payload: TaskStatusUpdate, session: DatabaseSession, user: CurrentUser
) -> Task:
    task = session.scalar(
        select(TaskRecord)
        .where(TaskRecord.id == task_id, task_access(user.id))
        .with_for_update()
    )
    if task is None:
        raise task_not_found()

    previous_status = task.status
    task.status = payload.status
    notify_status_change(session, task, user, previous_status)
    session.commit()
    return task_response(task, user.id)


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
