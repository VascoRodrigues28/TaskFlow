import { request } from "./api";

export type TaskNotification = {
  id: string;
  kind: "task_added" | "task_in_progress" | "task_completed";
  actor_email: string;
  project_name: string;
  task_title: string;
  task_id: number | null;
  project_id: string | null;
  created_at: string;
  read_at: string | null;
};

export type NotificationFeed = { items: TaskNotification[]; unread_count: number };

export async function listNotifications(signal: AbortSignal): Promise<NotificationFeed> {
  return (await request("/notifications", { signal })).json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await request(`/notifications/${id}/read`, { method: "PUT" });
}

export async function deleteNotification(id: string): Promise<void> {
  await request(`/notifications/${id}`, { method: "DELETE" });
}
