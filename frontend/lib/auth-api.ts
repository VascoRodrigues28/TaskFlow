import { request } from "./api";

export type Theme = "dark" | "light" | "system";
export type Language = "pt" | "en";
export type Profile = { display_name: string; bio: string; theme: Theme; language: Language };
export type User = Profile & { id: string; email: string };

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

export async function saveProfile(profile: Profile): Promise<User> {
  const response = await request("/auth/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  return response.json();
}

export async function changeCredentials(input: { current_password: string; email?: string; new_password?: string }) {
  await request("/auth/credentials", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
