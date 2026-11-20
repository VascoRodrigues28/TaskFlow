import { request } from "./api";

export type Project = { id: string; name: string; description: string };

export async function listProjects(signal: AbortSignal): Promise<Project[]> {
  const response = await request("/projects", { signal });
  return response.json();
}
