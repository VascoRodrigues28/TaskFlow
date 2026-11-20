import { request } from "./api";

export type Project = { id: string; name: string; description: string };
export type ProjectInput = Omit<Project, "id">;

export async function listProjects(signal: AbortSignal): Promise<Project[]> {
  const response = await request("/projects", { signal });
  return response.json();
}

export async function saveProject(project: ProjectInput, id?: string): Promise<Project> {
  const response = await request(id ? `/projects/${id}` : "/projects", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  return response.json();
}

export async function removeProject(id: string): Promise<void> {
  await request(`/projects/${id}`, { method: "DELETE" });
}
