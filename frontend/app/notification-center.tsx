"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api";
import { listNotifications, markNotificationRead, type NotificationFeed } from "@/lib/notifications-api";
import { listInvitations, type Invitation } from "@/lib/projects-api";

const action = {
  task_added: "adicionou a tarefa",
  task_in_progress: "passou para Em progresso a tarefa",
  task_completed: "concluiu a tarefa",
};

const dateFormat = new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" });

export function NotificationCenter({
  onAccept, onUnauthorized, disabled,
}: {
  onAccept: (id: string) => Promise<boolean>;
  onUnauthorized: () => void;
  disabled: boolean;
}) {
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
        aria-label={unread ? `Notificações (${unread} por ver)` : "Notificações"}
        aria-expanded={open} aria-controls={open ? "notification-panel" : undefined}
        className="relative rounded-lg border border-white/20 p-2.5 text-zinc-300 hover:bg-white/5"
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
        <section id="notification-panel" aria-label="Notificações"
          className="fixed inset-x-4 top-24 z-30 max-h-[65vh] overflow-y-auto rounded-xl border border-white/10 bg-[#18181b] p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96">
          <h3 className="mb-3 text-lg font-semibold">Notificações</h3>
          {loadError && (
            <div className="mb-3 text-sm text-red-400">
              <p role="alert">{loadError}</p>
              <button type="button" className="mt-2 underline" onClick={() => setRefresh((value) => value + 1)}>
                Tentar novamente
              </button>
            </div>
          )}
          {actionError && <p role="alert" className="mb-3 text-sm text-red-400">{actionError}</p>}
          {!feed && !loadError && <p role="status" className="text-sm text-zinc-400">A carregar notificações…</p>}
          {feed && !feed.items.length && !invitations.length && (
            <p className="text-sm text-zinc-400">Ainda não tens notificações.</p>
          )}
          <ul className="space-y-2">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-3 text-sm">
                <p className="break-words">Recebeste um convite para <strong>{invitation.project_name}</strong>.</p>
                <button
                  type="button" disabled={pending || disabled}
                  aria-label={`Aceitar convite para ${invitation.project_name}`}
                  className="mt-2 rounded-lg bg-emerald-400 px-3 py-1.5 font-semibold text-black disabled:opacity-50"
                  onClick={() => run(async () => {
                    if (await onAccept(invitation.id)) {
                      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
                    }
                  })}
                >
                  Aceitar convite
                </button>
              </li>
            ))}
            {feed?.items.map((notification) => (
              <li key={notification.id} className="rounded-lg border border-white/10 bg-zinc-900 p-3 text-sm">
                <p className="break-words"><strong>{notification.actor_email}</strong> {action[notification.kind]} <strong>{notification.task_title}</strong> em <strong>{notification.project_name}</strong>.</p>
                <time dateTime={notification.created_at} className="mt-1 block text-xs text-zinc-400">
                  {dateFormat.format(new Date(notification.created_at))}
                </time>
                {!notification.read_at && (
                  <button
                    type="button" disabled={pending}
                    className="mt-2 text-xs text-emerald-400 underline disabled:opacity-50"
                    onClick={() => run(() => markNotificationRead(notification.id))}
                  >
                    Marcar como lida
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
