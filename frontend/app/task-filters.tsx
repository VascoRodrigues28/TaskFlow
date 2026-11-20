import type { Task, TaskPriority, TaskStatus } from "@/lib/tasks-api";
import { priorityLabel, useLanguage } from "@/lib/language";

type Filters = {
  query: string;
  priority: TaskPriority | "";
  status: TaskStatus | "";
};

export const defaultTaskFilters: Filters = { query: "", priority: "", status: "" };

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-PT");
}

export function filterTasks(tasks: Task[], filters: Filters): Task[] {
  const query = normalize(filters.query.trim());
  return tasks.filter((task) =>
    (!filters.priority || task.priority === filters.priority)
    && (!filters.status || task.status === filters.status)
    && (!query || normalize(`${task.title} ${task.description}`).includes(query))
  );
}

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  columns: readonly { id: TaskStatus; title: string }[];
  disabled: boolean;
};

const fieldStyle = "w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-foreground disabled:opacity-50";
const labelStyle = "mb-2 block text-sm text-muted";

export function TaskFilters({ filters, onChange, columns, disabled }: Props) {
  const { t, language } = useLanguage();
  const hasFilters = filters.query !== "" || filters.priority !== "" || filters.status !== "";

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div>
        <label htmlFor="task-search" className={labelStyle}>{t("Pesquisar tarefas", "Search tasks")}</label>
        <input
          id="task-search" type="search" value={filters.query} disabled={disabled}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          className={fieldStyle} placeholder={t("Título ou descrição", "Title or description")}
        />
      </div>
      <div>
        <label htmlFor="priority-filter" className={labelStyle}>{t("Filtrar por prioridade", "Filter by priority")}</label>
        <select
          id="priority-filter" value={filters.priority} disabled={disabled}
          onChange={(event) => onChange({ ...filters, priority: event.target.value as Filters["priority"] })}
          className={fieldStyle}
        >
          <option value="">{t("Todas as prioridades", "All priorities")}</option>
          {(["Baixa", "Média", "Alta"] as const).map((value) => (
            <option key={value} value={value}>{priorityLabel(value, language)}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="status-filter" className={labelStyle}>{t("Filtrar por estado", "Filter by status")}</label>
        <select
          id="status-filter" value={filters.status} disabled={disabled}
          onChange={(event) => onChange({ ...filters, status: event.target.value as Filters["status"] })}
          className={fieldStyle}
        >
          <option value="">{t("Todos os estados", "All statuses")}</option>
          {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
        </select>
      </div>
      {hasFilters && (
        <button
          type="button" disabled={disabled} onClick={() => onChange(defaultTaskFilters)}
          className="justify-self-start rounded-lg px-2 py-1 text-sm text-accent hover:bg-tint disabled:opacity-50"
        >
          {t("Limpar filtros", "Clear filters")}
        </button>
      )}
    </div>
  );
}
