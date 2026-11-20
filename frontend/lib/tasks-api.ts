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
const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, { cache: "no-store", ...options });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = typeof body?.detail === "string"
      ? body.detail
      : `A API devolveu o erro ${response.status}.`;
    throw new Error(message);
  }

  return response;
}

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
