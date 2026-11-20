import type { Project } from "@/lib/projects-api";
import type { Task } from "@/lib/tasks-api";
import { priorityLabel, useLanguage } from "@/lib/language";

const priorityOrder = { Alta: 0, Média: 1, Baixa: 2 };

function compareDueDates(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

export function DashboardOverview({
  projects, tasks, onViewTasks,
}: {
  projects: Project[];
  tasks: Task[];
  onViewTasks: (id: string) => void;
}) {
  const { t, language } = useLanguage();
  const counts = new Map<string, { total: number; done: number }>();
  for (const task of tasks) {
    if (!task.project_id) continue;
    const count = counts.get(task.project_id) ?? { total: 0, done: 0 };
    count.total += 1;
    if (task.status === "done") count.done += 1;
    counts.set(task.project_id, count);
  }

  const upcoming = tasks
    .filter((task) => task.status !== "done" && (task.due_date !== null || task.priority === "Alta"))
    .sort((left, right) =>
      Number(right.priority === "Alta") - Number(left.priority === "Alta")
      || compareDueDates(left.due_date, right.due_date)
      || priorityOrder[left.priority] - priorityOrder[right.priority]
      || left.id - right.id
    )
    .slice(0, 5);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <div className="mb-10 space-y-8">
      <section aria-labelledby="project-progress-title">
        <h3 id="project-progress-title" className="mb-4 text-xl font-semibold">{t("Os teus projetos", "Your projects")}</h3>
        {projects.length === 0 && <p className="text-sm text-muted">{t("Ainda não participas em nenhum projeto.", "You haven't joined any projects yet.")}</p>}
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const { total, done } = counts.get(project.id) ?? { total: 0, done: 0 };
            const percentage = total ? Math.round(done / total * 100) : 0;
            return (
              <li key={project.id} className="min-w-0 rounded-xl border border-line bg-panel p-4">
                <button type="button" className="break-words text-left font-semibold text-accent hover:underline" onClick={() => onViewTasks(project.id)}>
                  {project.name}
                </button>
                <p className="mt-2 text-sm text-muted">{t(`${done} de ${total} concluídas`, `${done} of ${total} completed`)} · {percentage}%</p>
                <progress aria-label={t(`Conclusão de ${project.name}`, `Completion of ${project.name}`)} max={100} value={percentage} className="mt-3 h-2 w-full accent-emerald-500" />
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby="upcoming-tasks-title">
        <h3 id="upcoming-tasks-title" className="mb-4 text-xl font-semibold">{t("Tarefas com prazos próximos e de prioridade alta", "Tasks due soon and high-priority tasks")}</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">{t("Sem tarefas pendentes com prazo ou prioridade alta.", "No pending tasks with a due date or high priority.")}</p>
        ) : (
          <ol className="divide-y divide-line rounded-xl border border-line bg-panel">
            {upcoming.map((task) => (
              <li key={task.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{task.title}</p>
                  {task.project_id && <p className="text-sm text-muted">{projectNames.get(task.project_id)}</p>}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted">
                  <span>{t("Prioridade", "Priority")} {priorityLabel(task.priority, language)}</span>
                  {task.due_date ? (
                    <time dateTime={task.due_date}>{task.due_date.split("-").reverse().join("/")}</time>
                  ) : <span>{t("Sem prazo definido", "No due date")}</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
