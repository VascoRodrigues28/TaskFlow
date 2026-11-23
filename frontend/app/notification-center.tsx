"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, Trash2 } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api";
import { localizeError, useLanguage } from "@/lib/language";
import { startLiveRefresh } from "@/lib/live-refresh";
import { deleteNotification, listNotifications, markNotificationRead, type NotificationFeed, type TaskNotification } from "@/lib/notifications-api";
import { listInvitations, type Invitation } from "@/lib/projects-api";

const action = {
  task_added: ["adicionou a tarefa", "added the task"],
  task_in_progress: ["passou para Em progresso a tarefa", "started the task"],
  task_completed: ["concluiu a tarefa", "completed the task"],
} as const;

const dateFormat = {
  pt: new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }),
  en: new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }),
};

export function NotificationCenter({
  onAccept, onOpen, onUnauthorized, disabled,
}: {
  onAccept: (id: string, projectId: string) => Promise<boolean>;
  onOpen: (notification: TaskNotification) => Promise<void>;
  onUnauthorized: () => void;
  disabled: boolean;
}) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pending) return;
    return startLiveRefresh(async (signal) => {
      try {
        const [nextFeed, nextInvitations] = await Promise.all([
          listNotifications(signal), listInvitations(signal),
        ]);
        if (signal.aborted) return;
        setFeed(nextFeed);
        setInvitations(nextInvitations);
        setLoadError("");
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
        } else {
          setLoadError(errorMessage(error));
        }
      }
    });
  }, [onUnauthorized, pending, refresh]);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setActionError("");
    try {
      await action();
      setRefresh((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
      } else {
        setActionError(errorMessage(error));
      }
    } finally {
      setPending(false);
    }
  }

  const unread = (feed?.unread_count ?? 0) + invitations.length;

  function removeNotification(id: string) {
    return run(async () => {
      await deleteNotification(id);
      setFeed((previous) => {
        const item = previous?.items.find((notification) => notification.id === id);
        if (!previous || !item) return previous;
        return {
          items: previous.items.filter((notification) => notification.id !== id),
          unread_count: Math.max(0, previous.unread_count - Number(item.read_at === null)),
        };
      });
    });
  }

  return (
    <div className="relative" onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }}>
      <button
        ref={buttonRef} type="button"
        aria-label={unread ? t(`Notificações (${unread} por ver)`, `Notifications (${unread} unread)`) : t("Notificações", "Notifications")}
        aria-expanded={open} aria-controls={open ? "notification-panel" : undefined}
        className="relative rounded-lg border border-line-strong p-2.5 text-muted hover:bg-tint"
        onClick={() => {
          setOpen(!open);
          if (!open) setRefresh((value) => value + 1);
        }}
      >
        <Bell size={19} aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -right-2 -top-2 rounded-full bg-emerald-400 px-1.5 text-xs font-bold text-black">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <section id="notification-panel" aria-label={t("Notificações", "Notifications")}
          className="fixed inset-x-4 top-24 z-30 max-h-[65vh] overflow-y-auto rounded-xl border border-line bg-dialog p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96">
          <h3 className="mb-3 text-lg font-semibold">{t("Notificações", "Notifications")}</h3>
          {loadError && (
            <div className="mb-3 text-sm text-danger">
              <p role="alert">{localizeError(loadError, language)}</p>
              <button type="button" className="mt-2 underline" onClick={() => setRefresh((value) => value + 1)}>
                {t("Tentar novamente", "Try again")}
              </button>
            </div>
          )}
          {actionError && <p role="alert" className="mb-3 text-sm text-danger">{localizeError(actionError, language)}</p>}
          {!feed && !loadError && <p role="status" className="text-sm text-muted">{t("A carregar notificações…", "Loading notifications…")}</p>}
          {feed && !feed.items.length && !invitations.length && (
            <p className="text-sm text-muted">{t("Ainda não tens notificações.", "You have no notifications yet.")}</p>
          )}
          <ul className="space-y-2">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3 text-sm">
                <p className="break-words">{t("Recebeste um convite para", "You were invited to")} <strong>{invitation.project_name}</strong>.</p>
                <button
                  type="button" disabled={pending || disabled}
                  aria-label={t(`Aceitar convite para ${invitation.project_name}`, `Accept invitation to ${invitation.project_name}`)}
                  className="mt-2 rounded-lg bg-emerald-400 px-3 py-1.5 font-semibold text-black disabled:opacity-50"
                  onClick={() => run(async () => {
                    if (await onAccept(invitation.id, invitation.project_id)) {
                      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
                      setOpen(false);
                    }
                  })}
                >
                  {t("Aceitar convite", "Accept invitation")}
                </button>
              </li>
            ))}
            {feed?.items.map((notification) => {
              const message = (
                <>
                  <span className="block break-words"><strong>{notification.actor_email}</strong> {t(action[notification.kind][0], action[notification.kind][1])} <strong>{notification.task_title}</strong> {t("em", "in")} <strong>{notification.project_name}</strong>.</span>
                  <time dateTime={notification.created_at} className="mt-1 block text-xs text-muted">
                    {dateFormat[language].format(new Date(notification.created_at))}
                  </time>
                </>
              );
              const linkable = notification.task_id != null || notification.project_id != null;
              return (
              <li key={notification.id} className="rounded-lg border border-line bg-field p-3 text-sm">
                {linkable ? (
                  <button
                    type="button" disabled={pending || disabled}
                    className="flex w-full items-start justify-between gap-2 rounded text-left hover:text-accent disabled:opacity-50"
                    onClick={() => run(async () => {
                      await onOpen(notification);
                      setOpen(false);
                      if (!notification.read_at) await markNotificationRead(notification.id);
                    })}
                  >
                    <span className="min-w-0">{message}</span>
                    <ArrowUpRight size={16} aria-hidden="true" className="shrink-0 text-accent" />
                  </button>
                ) : message}
                <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
                  {!notification.read_at && (
                    <button
                      type="button" disabled={pending}
                      className="text-xs text-accent underline disabled:opacity-50"
                      onClick={() => run(() => markNotificationRead(notification.id))}
                    >
                      {t("Marcar como lida", "Mark as read")}
                    </button>
                  )}
                  <button
                    type="button" disabled={pending}
                    title={t("Eliminar notificação", "Delete notification")}
                    aria-label={t("Eliminar notificação", "Delete notification")}
                    className="rounded-md p-1.5 text-muted hover:bg-red-500/10 hover:text-danger disabled:opacity-50"
                    onClick={() => removeNotification(notification.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
