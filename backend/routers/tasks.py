from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Response, status
from sqlalchemy import delete, func, or_, select

from activity import record_contribution
from models import ProjectRecord, TaskCommentRecord, TaskHistoryRecord, TaskRecord, UserRecord
from routers.auth import CurrentUser, DatabaseSession
from routers.projects import project_access, project_not_found
from schemas.task_comments import TaskComment, TaskCommentCreate
from schemas.task_history import HistoryAction, TaskHistoryItem
from schemas.tasks import Task, TaskAssignmentUpdate, TaskCompletionUpdate, TaskCreate, TaskUpdate
from task_activity import record_task_activity

router = APIRouter(prefix="/tasks", tags=["Tarefas"])
TaskId = Annotated[int, Path(gt=0)]
MAX_ACTIVE_ASSIGNMENTS = 5


def record_history(
    session: DatabaseSession, task: TaskRecord, user: CurrentUser,
    action: HistoryAction, assignee_name: str | None = None,
) -> None:
    if task.id is None:
        session.flush()
    session.add(TaskHistoryRecord(
        task_id=task.id,
        action=action,
        actor_name=user.display_name or user.email,
        assignee_name=assignee_name,
    ))


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
    return Task.model_validate(task).model_copy(update={"is_owner": task.owner_id == user_id})


def can_assign_to(session: DatabaseSession, task: TaskRecord, assignee_id: UUID) -> bool:
    if task.project_id is None:
        return task.owner_id == assignee_id
    return session.scalar(
        select(ProjectRecord.id).where(ProjectRecord.id == task.project_id, project_access(assignee_id))
    ) is not None


def require_capacity(session: DatabaseSession, assignee_id: UUID) -> None:
    # Serialise new active assignments for this user without blocking foreign-key checks.
    session.scalar(select(UserRecord.id).where(UserRecord.id == assignee_id).with_for_update(key_share=True))
    count = session.scalar(
        select(func.count()).select_from(TaskRecord)
        .where(TaskRecord.assignee_id == assignee_id, TaskRecord.status == "progress")
    )
    if count is not None and count >= MAX_ACTIVE_ASSIGNMENTS:
        raise HTTPException(status_code=409, detail="Esta pessoa já tem cinco tarefas em progresso.")


def locked_accessible_task(session: DatabaseSession, task_id: int, user_id: UUID) -> TaskRecord:
    task = session.scalar(
        select(TaskRecord).where(TaskRecord.id == task_id, task_access(user_id)).with_for_update()
    )
    if task is None:
        raise task_not_found()
    return task


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


@router.get("/{task_id}/history")
def get_task_history(task_id: TaskId, session: DatabaseSession, user: CurrentUser) -> list[TaskHistoryItem]:
    access = (TaskRecord.id == task_id, task_access(user.id))
    if session.scalar(select(TaskRecord.id).where(*access)) is None:
        raise task_not_found()
    statement = (
        select(TaskHistoryRecord).join(TaskRecord).where(*access)
        .order_by(TaskHistoryRecord.id.desc())
    )
    return [TaskHistoryItem.model_validate(item) for item in session.scalars(statement)]


@router.get("/{task_id}/comments")
def list_task_comments(task_id: TaskId, session: DatabaseSession, user: CurrentUser) -> list[TaskComment]:
    access = (TaskRecord.id == task_id, task_access(user.id))
    if session.scalar(select(TaskRecord.id).where(*access)) is None:
        raise task_not_found()
    statement = select(TaskCommentRecord).join(TaskRecord).where(*access).order_by(TaskCommentRecord.id)
    return [TaskComment.model_validate(item) for item in session.scalars(statement)]


@router.post("/{task_id}/comments", status_code=status.HTTP_201_CREATED)
def create_task_comment(
    task_id: TaskId, payload: TaskCommentCreate, session: DatabaseSession, user: CurrentUser,
) -> TaskComment:
    task = locked_accessible_task(session, task_id, user.id)
    comment = TaskCommentRecord(task_id=task.id, author_name=user.display_name or user.email, body=payload.body)
    session.add(comment)
    session.commit()
    return TaskComment.model_validate(comment)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, session: DatabaseSession, user: CurrentUser) -> Task:
    if payload.project_id is not None:
        require_project(session, payload.project_id, user.id, lock=True)
    task = TaskRecord(**payload.model_dump(), owner_id=user.id, status="todo")
    session.add(task)
    record_task_activity(session, task, user, "task_added")
    record_history(session, task, user, "created")
    record_contribution(session, user.id)
    session.commit()
    return task_response(task, user.id)


@router.put("/{task_id}")
def update_task(task_id: TaskId, payload: TaskUpdate, session: DatabaseSession, user: CurrentUser) -> Task:
    if payload.project_id is not None:
        require_project(session, payload.project_id, user.id, lock=True)
    task = locked_accessible_task(session, task_id, user.id)
    if (
        "project_id" in payload.model_fields_set
        and payload.project_id != task.project_id
        and task.owner_id != user.id
    ):
        raise HTTPException(status_code=403, detail="Só o autor pode mudar o projeto da tarefa.")
    previous_project_id = task.project_id
    changes = {
        field: value for field, value in payload.model_dump(exclude_unset=True).items()
        if getattr(task, field) != value
    }
    for field, value in changes.items():
        setattr(task, field, value)
    if task.project_id != previous_project_id:
        if task.assignee_id is not None and not can_assign_to(session, task, task.assignee_id):
            task.assignee_id = None
            if task.status == "progress":
                task.status = "todo"
        record_task_activity(session, task, user, "task_added")
    if changes:
        record_history(session, task, user, "edited")
    session.commit()
    return task_response(task, user.id)


@router.patch("/{task_id}/assignment")
def update_task_assignment(
    task_id: TaskId, payload: TaskAssignmentUpdate, session: DatabaseSession, user: CurrentUser
) -> Task:
    task = locked_accessible_task(session, task_id, user.id)
    assignee_id = payload.assignee_id
    if task.assignee_id == assignee_id:
        return task_response(task, user.id)
    if assignee_id is not None:
        if not can_assign_to(session, task, assignee_id):
            raise HTTPException(status_code=422, detail="Escolhe uma pessoa que participe no projeto.")
        if task.status != "done":
            require_capacity(session, assignee_id)

    previous_status = task.status
    task.assignee_id = assignee_id
    if task.status != "done":
        task.status = "progress" if assignee_id is not None else "todo"
    notify_status_change(session, task, user, previous_status)
    if assignee_id is not None:
        record_contribution(session, user.id)
        assignee = session.get(UserRecord, assignee_id)
        record_history(session, task, user, "assigned", (assignee.display_name or assignee.email) if assignee else None)
    else:
        record_history(session, task, user, "unassigned")
    session.commit()
    return task_response(task, user.id)


@router.patch("/{task_id}/completion")
def update_task_completion(
    task_id: TaskId, payload: TaskCompletionUpdate, session: DatabaseSession, user: CurrentUser
) -> Task:
    task = locked_accessible_task(session, task_id, user.id)
    previous_status = task.status
    if payload.completed:
        task.status = "done"
    elif task.assignee_id is None:
        task.status = "todo"
    else:
        if previous_status == "done":
            require_capacity(session, task.assignee_id)
        task.status = "progress"
    notify_status_change(session, task, user, previous_status)
    if payload.completed and previous_status != "done":
        record_contribution(session, user.id)
        record_history(session, task, user, "completed")
    elif not payload.completed and previous_status == "done":
        record_history(session, task, user, "reopened")
    session.commit()
    return task_response(task, user.id)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: TaskId, session: DatabaseSession, user: CurrentUser) -> Response:
    statement = (
        delete(TaskRecord)
        .where(TaskRecord.id == task_id, task_access(user.id))
        .returning(TaskRecord.id)
    )
    if session.scalar(statement) is None:
        raise task_not_found()
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
