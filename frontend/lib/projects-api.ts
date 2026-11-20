import { request } from "./api";

export type Project = { id: string; name: string; description: string; role: "host" | "member" };
export type ProjectInput = Pick<Project, "name" | "description">;
export type Invitation = { id: string; project_id: string; project_name: string };
export type ProjectMember = { id: string; project_id: string; name: string };

export async function listProjectMembers(signal: AbortSignal): Promise<ProjectMember[]> {
  return (await request("/projects/members", { signal })).json();
}

export async function listProjects(signal: AbortSignal): Promise<Project[]> {
  const response = await request("/projects", { signal });
  return response.json();
}

export async function getProject(id: string): Promise<Project> {
  return (await request(`/projects/${id}`)).json();
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

export async function listInvitations(signal: AbortSignal): Promise<Invitation[]> {
  const response = await request("/projects/invitations", { signal });
  return response.json();
}

export async function sendInvitation(id: string, email: string): Promise<void> {
  await request(`/projects/${id}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function acceptInvitation(id: string): Promise<void> {
  await request(`/projects/invitations/${id}/accept`, { method: "POST" });
}
