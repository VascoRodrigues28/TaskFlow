import { request } from "./api";

export type TaskStatus = "todo" | "progress" | "done";
export type TaskPriority = "Baixa" | "Média" | "Alta";

export type Task = {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
};

type TaskInput = Omit<Task, "id">;

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
