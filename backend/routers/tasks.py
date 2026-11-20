from itertools import count
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Response, status

from schemas.tasks import Task, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Tarefas"])
TaskId = Annotated[int, Path(gt=0)]

# These handlers run without suspension on the server's event loop.
tasks: dict[int, Task] = {}
task_ids = count(1)


def task_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tarefa não encontrada.")


@router.get("")
async def list_tasks() -> list[Task]:
    return list(tasks.values())


@router.get("/{task_id}")
async def get_task(task_id: TaskId) -> Task:
    task = tasks.get(task_id)
    if task is None:
        raise task_not_found()
    return task


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate) -> Task:
    task = Task(id=next(task_ids), **payload.model_dump())
    tasks[task.id] = task
    return task


@router.put("/{task_id}")
async def update_task(task_id: TaskId, payload: TaskUpdate) -> Task:
    if task_id not in tasks:
        raise task_not_found()
    task = Task(id=task_id, **payload.model_dump())
    tasks[task_id] = task
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: TaskId) -> Response:
    if tasks.pop(task_id, None) is None:
        raise task_not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
