import { request } from "./api";

export type User = { id: string; email: string };

export async function getProfile(signal?: AbortSignal): Promise<User> {
  const response = await request("/auth/me", { signal });
  return response.json();
}

export async function submitCredentials(mode: "login" | "register", email: string, password: string) {
  await request(`/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  await request("/auth/logout", { method: "POST" });
}
