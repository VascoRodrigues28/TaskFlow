import type { Project } from "@/lib/projects-api";
import type { Task } from "@/lib/tasks-api";

const priorityOrder = { Alta: 0, Média: 1, Baixa: 2 };

export function DashboardOverview({
  projects, tasks, onViewTasks,
}: {
  projects: Project[];
  tasks: Task[];
  onViewTasks: (id: string) => void;
}) {
  const counts = new Map<string, { total: number; done: number }>();
  for (const task of tasks) {
    if (!task.project_id) continue;
    const count = counts.get(task.project_id) ?? { total: 0, done: 0 };
    count.total += 1;
    if (task.status === "done") count.done += 1;
    counts.set(task.project_id, count);
  }

  const upcoming = tasks
    .filter((task): task is Task & { due_date: string } => task.status !== "done" && task.due_date !== null)
    .sort((left, right) =>
      left.due_date.localeCompare(right.due_date)
      || priorityOrder[left.priority] - priorityOrder[right.priority]
      || left.id - right.id
    );
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <div className="mb-10 space-y-8">
      <section aria-labelledby="project-progress-title">
        <h3 id="project-progress-title" className="mb-4 text-xl font-semibold">Os teus projetos</h3>
        {projects.length === 0 && <p className="text-sm text-zinc-400">Ainda não participas em nenhum projeto.</p>}
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const { total, done } = counts.get(project.id) ?? { total: 0, done: 0 };
            const percentage = total ? Math.round(done / total * 100) : 0;
            return (
              <li key={project.id} className="min-w-0 rounded-xl border border-white/10 bg-[#111113] p-4">
                <button type="button" className="break-words text-left font-semibold text-emerald-400 hover:underline" onClick={() => onViewTasks(project.id)}>
                  {project.name}
                </button>
                <p className="mt-2 text-sm text-zinc-400">{done} de {total} concluídas · {percentage}%</p>
                <progress aria-label={`Conclusão de ${project.name}`} max={100} value={percentage} className="mt-3 h-2 w-full accent-emerald-500" />
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby="upcoming-tasks-title">
        <h3 id="upcoming-tasks-title" className="mb-4 text-xl font-semibold">Tarefas com prazos mais próximos</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-zinc-400">Sem tarefas pendentes com prazo definido.</p>
        ) : (
          <ol className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#111113]">
            {upcoming.map((task) => (
              <li key={task.id} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{task.title}</p>
                  {task.project_id && <p className="text-sm text-zinc-400">{projectNames.get(task.project_id)}</p>}
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <span>Prioridade {task.priority}</span>
                  <time dateTime={task.due_date}>{task.due_date.split("-").reverse().join("/")}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
