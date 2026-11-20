"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api";
import { localizeError, useLanguage } from "@/lib/language";
import { listNotifications, markNotificationRead, type NotificationFeed } from "@/lib/notifications-api";
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
  onAccept, onUnauthorized, disabled,
}: {
  onAccept: (id: string) => Promise<boolean>;
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
    let controller: AbortController | undefined;

    async function load() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const [nextFeed, nextInvitations] = await Promise.all([
          listNotifications(request.signal), listInvitations(request.signal),
        ]);
        if (request.signal.aborted) return;
        setFeed(nextFeed);
        setInvitations(nextInvitations);
        setLoadError("");
      } catch (error) {
        if (request.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
        } else {
          setLoadError(errorMessage(error));
        }
      }
    }

    void load();
    const timer = window.setInterval(load, 15_000);
    window.addEventListener("focus", load);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [onUnauthorized, refresh]);

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
                    if (await onAccept(invitation.id)) {
                      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
                    }
                  })}
                >
                  {t("Aceitar convite", "Accept invitation")}
                </button>
              </li>
            ))}
            {feed?.items.map((notification) => (
              <li key={notification.id} className="rounded-lg border border-line bg-field p-3 text-sm">
                <p className="break-words"><strong>{notification.actor_email}</strong> {t(action[notification.kind][0], action[notification.kind][1])} <strong>{notification.task_title}</strong> {t("em", "in")} <strong>{notification.project_name}</strong>.</p>
                <time dateTime={notification.created_at} className="mt-1 block text-xs text-muted">
                  {dateFormat[language].format(new Date(notification.created_at))}
                </time>
                {!notification.read_at && (
                  <button
                    type="button" disabled={pending}
                    className="mt-2 text-xs text-accent underline disabled:opacity-50"
                    onClick={() => run(() => markNotificationRead(notification.id))}
                  >
                    {t("Marcar como lida", "Mark as read")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
