"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { localizeError, useLanguage } from "@/lib/language";
import { startLiveRefresh } from "@/lib/live-refresh";
import { getTaskHistory, type TaskHistoryItem } from "@/lib/tasks-api";

const labels = {
  created: ["criou a tarefa", "created the task"],
  edited: ["editou a tarefa", "edited the task"],
  assigned: ["atribuiu a tarefa", "assigned the task"],
  unassigned: ["retirou o responsável", "removed the assignee"],
  completed: ["concluiu a tarefa", "completed the task"],
  reopened: ["reabriu a tarefa", "reopened the task"],
} as const;

export function TaskHistory({ taskId }: { taskId: number }) {
  const { t, language } = useLanguage();
  const [items, setItems] = useState<TaskHistoryItem[] | null>(null);
  const [error, setError] = useState("");
  const dateFormat = new Intl.DateTimeFormat(language === "pt" ? "pt-PT" : "en-GB", {
    dateStyle: "medium", timeStyle: "short",
  });

  useEffect(() => startLiveRefresh(async (signal) => {
    try {
      const history = await getTaskHistory(taskId, signal);
      if (signal.aborted) return;
      setItems(history);
      setError("");
    } catch (error) {
      if (!signal.aborted) setError(errorMessage(error));
    }
  }), [taskId]);

  return (
    <section className="border-t border-line pt-4" aria-labelledby="task-history-title">
      <h3 id="task-history-title" className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <History size={16} aria-hidden="true" className="text-accent" />
        {t("Histórico da tarefa", "Task history")}
      </h3>
      {error && <p role="alert" className="text-sm text-danger">{localizeError(error, language)}</p>}
      {!items && !error && <p role="status" className="text-sm text-muted">{t("A carregar histórico…", "Loading history…")}</p>}
      {items?.length === 0 && <p className="text-sm text-muted">{t("Ainda não há alterações registadas.", "No changes recorded yet.")}</p>}
      {!!items?.length && (
        <ol className="divide-y divide-line rounded-lg border border-line bg-field">
          {items.map((item) => {
            const [pt, en] = labels[item.action];
            return (
              <li key={item.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
                <p className="min-w-0 break-words">
                  <strong>{item.actor_name}</strong> {t(pt, en)}
                  {item.assignee_name && <> {t("a", "to")} <strong>{item.assignee_name}</strong></>}.
                </p>
                <time dateTime={item.created_at} className="text-xs text-muted">
                  {dateFormat.format(new Date(item.created_at))}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
