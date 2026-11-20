import type { Task, TaskPriority, TaskStatus } from "@/lib/tasks-api";

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

const fieldStyle = "w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50";
const labelStyle = "mb-2 block text-sm text-zinc-300";

export function TaskFilters({ filters, onChange, columns, disabled }: Props) {
  const hasFilters = filters.query !== "" || filters.priority !== "" || filters.status !== "";

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div>
        <label htmlFor="task-search" className={labelStyle}>Pesquisar tarefas</label>
        <input
          id="task-search" type="search" value={filters.query} disabled={disabled}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          className={fieldStyle} placeholder="Título ou descrição"
        />
      </div>
      <div>
        <label htmlFor="priority-filter" className={labelStyle}>Filtrar por prioridade</label>
        <select
          id="priority-filter" value={filters.priority} disabled={disabled}
          onChange={(event) => onChange({ ...filters, priority: event.target.value as Filters["priority"] })}
          className={fieldStyle}
        >
          <option value="">Todas as prioridades</option>
          <option value="Baixa">Baixa</option>
          <option value="Média">Média</option>
          <option value="Alta">Alta</option>
        </select>
      </div>
      <div>
        <label htmlFor="status-filter" className={labelStyle}>Filtrar por estado</label>
        <select
          id="status-filter" value={filters.status} disabled={disabled}
          onChange={(event) => onChange({ ...filters, status: event.target.value as Filters["status"] })}
          className={fieldStyle}
        >
          <option value="">Todos os estados</option>
          {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
        </select>
      </div>
      {hasFilters && (
        <button
          type="button" disabled={disabled} onClick={() => onChange(defaultTaskFilters)}
          className="justify-self-start rounded-lg px-2 py-1 text-sm text-emerald-400 hover:bg-white/5 disabled:opacity-50"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
