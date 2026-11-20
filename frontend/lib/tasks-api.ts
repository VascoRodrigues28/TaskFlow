import { request } from "./api";

export type TaskStatus = "todo" | "progress" | "done";
export type TaskPriority = "Baixa" | "Média" | "Alta";

export type Task = {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: string | null;
  due_date: string | null;
  can_edit: boolean;
  assignee_id: string | null;
};

export type TaskInput = Pick<Task, "title" | "description" | "priority">
  & Partial<Pick<Task, "project_id" | "due_date">>;

export async function listTasks(signal: AbortSignal): Promise<Task[]> {
  const response = await request("/tasks", { signal });
  return response.json();
}

export async function saveTask(task: TaskInput, id?: number): Promise<Task> {
  const response = await request(id === undefined ? "/tasks" : `/tasks/${id}`, {
    method: id === undefined ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  return response.json();
}

export async function removeTask(id: number): Promise<void> {
  await request(`/tasks/${id}`, { method: "DELETE" });
}

export async function updateTaskWorkflow(
  id: number, change: { assignee_id: string | null } | { completed: boolean },
): Promise<Task> {
  const operation = "assignee_id" in change ? "assignment" : "completion";
  const response = await request(`/tasks/${id}/${operation}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
  return response.json();
}
