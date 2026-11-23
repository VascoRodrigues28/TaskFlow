import type { Task } from "@/lib/tasks-api";
import { priorityLabel, useLanguage } from "@/lib/language";

const priorityOrder = { Alta: 0, Média: 1, Baixa: 2 };

function localToday() {
  const date = new Date();
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function MyTasks({ tasks, projectNames, onOpen }: {
  tasks: Task[];
  projectNames: ReadonlyMap<string, string>;
  onOpen: (id: number) => void;
}) {
  const { t, language } = useLanguage();
  const today = localToday();
  const pending = tasks.filter((task) => task.status !== "done");
  const groups = [
    { id: "overdue", title: t("Vencidas", "Overdue"), tasks: pending.filter((task) => task.due_date && task.due_date < today) },
    { id: "upcoming", title: t("Próximos prazos", "Upcoming deadlines"), tasks: pending.filter((task) => task.due_date && task.due_date >= today) },
    { id: "undated", title: t("Sem prazo", "No due date"), tasks: pending.filter((task) => !task.due_date) },
    { id: "completed", title: t("Concluídas", "Completed"), tasks: tasks.filter((task) => task.status === "done") },
  ];

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-panel p-5 text-sm text-muted">
        {t("Ainda não tens tarefas atribuídas.", "No tasks have been assigned to you yet.")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.filter((group) => group.tasks.length > 0).map((group) => {
        const sorted = group.tasks.sort((left, right) =>
          (left.due_date ?? "9999-12-31").localeCompare(right.due_date ?? "9999-12-31")
          || priorityOrder[left.priority] - priorityOrder[right.priority]
          || left.id - right.id
        );
        return (
          <section key={group.id} aria-labelledby={`my-tasks-${group.id}`}>
            <h3 id={`my-tasks-${group.id}`} className={`mb-2 font-semibold ${group.id === "overdue" ? "text-danger" : ""}`}>
              {group.title}
            </h3>
            <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
              {sorted.map((task) => (
                <li key={task.id}>
                  <button
                    type="button" onClick={() => onOpen(task.id)} aria-label={task.title}
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-tint focus-visible:outline-2 focus-visible:outline-emerald-500"
                  >
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-semibold">{task.title}</span>
                      <span className="mt-0.5 block break-words text-xs text-muted">
                        {(task.project_id && projectNames.get(task.project_id)) || t("Sem projeto", "No project")}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-muted">
                      <span>{priorityLabel(task.priority, language)}</span>
                      {task.due_date && (
                        <time dateTime={task.due_date} className={group.id === "overdue" ? "font-semibold text-danger" : undefined}>
                          {task.due_date === today ? t("Hoje", "Today") : task.due_date.split("-").reverse().join("/")}
                        </time>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
