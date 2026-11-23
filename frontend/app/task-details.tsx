"use client";

import { useEffect, useRef } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import type { Task } from "@/lib/tasks-api";
import { localizeError, priorityLabel, useLanguage } from "@/lib/language";
import { TaskHistory } from "./task-history";

export function TaskDetails({
  task, status, project, participants, busy, assignmentUnavailable, feedback, onAssign, onComplete, onEdit, onDelete, onClose,
}: {
  task: Task;
  status: string;
  project?: string;
  participants: { id: string; name: string }[];
  busy: boolean;
  assignmentUnavailable: boolean;
  feedback: { type: "success" | "error"; text: string } | null;
  onAssign: (id: string | null) => void;
  onComplete: (completed: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t, language } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  const details = [
    { label: t("Estado", "Status"), value: status },
    { label: t("Prioridade", "Priority"), value: priorityLabel(task.priority, language) },
    { label: t("Projeto", "Project"), value: project ?? t("Sem projeto", "No project") },
    {
      label: t("Data de entrega", "Due date"),
      value: task.due_date
        ? <time dateTime={task.due_date}>{task.due_date.split("-").reverse().join("/")}</time>
        : t("Sem prazo definido", "No due date"),
    },
  ];

  return (
    <dialog
      ref={dialog} onClose={onClose} aria-labelledby="task-details-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialog.current?.close();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-line bg-dialog text-foreground shadow-2xl backdrop:bg-black/70"
    >
      <div className="space-y-5 p-5 sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-accent">TASK-{task.id}</p>
            <h2 id="task-details-title" className="mt-1 break-words text-xl font-semibold sm:text-2xl">{task.title}</h2>
          </div>
          <button
            type="button" onClick={() => dialog.current?.close()}
            aria-label={t("Fechar detalhes", "Close details")}
            className="shrink-0 rounded-lg p-2 text-muted hover:bg-tint hover:text-foreground"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-line bg-field p-4">
          {details.map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <dt className="mb-1 text-xs text-muted">{label}</dt>
              <dd className="break-words text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <section aria-labelledby="task-details-description">
          <h3 id="task-details-description" className="mb-2 text-sm font-semibold">{t("Descrição", "Description")}</h3>
          <p className="whitespace-pre-wrap break-words text-sm text-muted">
            {task.description || t("Sem descrição.", "No description.")}
          </p>
        </section>
        <div className="space-y-3 border-t border-line pt-4">
          <div>
            <label htmlFor="details-assignee" className="mb-1.5 block text-sm font-medium">{t("Responsável", "Assignee")}</label>
            <select
              id="details-assignee" value={task.assignee_id ?? ""}
              disabled={busy || assignmentUnavailable}
              onChange={(event) => onAssign(event.target.value || null)}
              className="w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-foreground disabled:opacity-50"
            >
              <option value="">{t("Sem responsável", "Unassigned")}</option>
              {task.assignee_id && !participants.some((person) => person.id === task.assignee_id) && (
                <option value={task.assignee_id}>{t("Responsável atual", "Current assignee")}</option>
              )}
              {participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </div>
          <label className="flex w-fit items-center gap-2 text-sm text-muted">
            <input
              type="checkbox" checked={task.status === "done"} disabled={busy}
              onChange={(event) => onComplete(event.target.checked)}
              className="size-4 accent-emerald-500"
            />
            {t("Concluída", "Completed")}
          </label>
          {feedback && (
            <p role={feedback.type === "error" ? "alert" : "status"}
              className={`text-sm ${feedback.type === "error" ? "text-danger" : "text-accent"}`}>
              {localizeError(feedback.text, language)}
            </p>
          )}
        </div>
        <TaskHistory key={task.id} taskId={task.id} />
        {task.can_edit && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onEdit} disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-tint disabled:opacity-50">
              <Pencil size={16} aria-hidden="true" />
              {t("Editar tarefa", "Edit task")}
            </button>
            <button type="button" onClick={onDelete} disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-danger hover:bg-red-500/10 disabled:opacity-50">
              <Trash2 size={16} aria-hidden="true" />
              {t("Eliminar tarefa", "Delete task")}
            </button>
          </footer>
        )}
      </div>
    </dialog>
  );
}
