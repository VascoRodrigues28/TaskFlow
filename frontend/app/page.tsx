
"use client";

import { useState, type FormEvent } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Settings,
  Plus,
  Circle,
  Clock3,
  CheckCircle2,
  CalendarDays,
  X,
  Pencil,
  Trash2,
} from "lucide-react";

type TaskStatus = "todo" | "progress" | "done";
type TaskPriority = "Baixa" | "Média" | "Alta";

type Task = {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
};

const initialTasks: Task[] = [
  {
    id: 1,
    title: "Criar página de login",
    description: "Desenvolver a interface de autenticação.",
    status: "todo",
    priority: "Alta",
  },
  {
    id: 2,
    title: "Configurar FastAPI",
    description: "Preparar a estrutura inicial do backend.",
    status: "progress",
    priority: "Média",
  },
  {
    id: 3,
    title: "Criar projeto Next.js",
    description: "Configurar TypeScript e Tailwind CSS.",
    status: "done",
    priority: "Baixa",
  },
];

const columns = [
  {
    id: "todo",
    title: "To Do",
    icon: Circle,
  },
  {
    id: "progress",
    title: "In Progress",
    icon: Clock3,
  },
  {
    id: "done",
    title: "Done",
    icon: CheckCircle2,
  },
] as const;

export default function Home() {
  // Estado das tarefas
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  // Estado do formulário
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<TaskPriority>("Média");

  // Criar nova tarefa
  
function addTask(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();

  if (!title.trim()) return;

  if (editingTaskId !== null) {
    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === editingTaskId
          ? {
              ...task,
              title: title.trim(),
              description: description.trim(),
              priority,
            }
          : task
      )
    );
  } else {
    const newTask: Task = {
      id: Date.now(),
      title: title.trim(),
      description: description.trim(),
      status: "todo",
      priority,
    };

    setTasks((previousTasks) => [...previousTasks, newTask]);
  }

  closeModal();
}


  function updateTaskStatus(
  taskId: number,
  newStatus: TaskStatus
) {
  setTasks((previousTasks) =>
    previousTasks.map((task) =>
      task.id === taskId
        ? { ...task, status: newStatus }
        : task
    )
  );
}

function editTask(task: Task) {
  setEditingTaskId(task.id);
  setTitle(task.title);
  setDescription(task.description);
  setPriority(task.priority);
  setShowModal(true);
}

function deleteTask(taskId: number) {
  const confirmed = window.confirm(
    "Tens a certeza de que queres eliminar esta tarefa?"
  );

  if (!confirmed) return;

  setTasks((previousTasks) =>
    previousTasks.filter((task) => task.id !== taskId)
  );
}

function closeModal() {
  setShowModal(false);
  setEditingTaskId(null);
  setTitle("");
  setDescription("");
  setPriority("Média");
}


  // Estatísticas
  const stats = [
    {
      title: "Total de tarefas",
      value: tasks.length,
      icon: ListTodo,
    },
    {
      title: "Por fazer",
      value: tasks.filter(
        (task) => task.status === "todo"
      ).length,
      icon: Circle,
    },
    {
      title: "Em progresso",
      value: tasks.filter(
        (task) => task.status === "progress"
      ).length,
      icon: Clock3,
    },
    {
      title: "Concluídas",
      value: tasks.filter(
        (task) => task.status === "done"
      ).length,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="flex min-h-screen">

        {/* SIDEBAR */}
        <aside className="hidden w-64 flex-col border-r border-white/10 bg-[#111113] p-6 md:flex">

          <h1 className="mb-12 text-2xl font-bold">
            Task
            <span className="text-emerald-400">
              Flow.
            </span>
          </h1>

          <nav className="space-y-2">
            {[
              {
                name: "Dashboard",
                icon: LayoutDashboard,
                active: true,
              },
              {
                name: "Projetos",
                icon: FolderKanban,
                active: false,
              },
              {
                name: "Tarefas",
                icon: ListTodo,
                active: false,
              },
              {
                name: "Definições",
                icon: Settings,
                active: false,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.name}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
                    item.active
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {item.name}
                </div>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-white/10 pt-6 text-sm text-zinc-500">
            TaskFlow v1.0
          </div>
        </aside>

        {/* CONTEÚDO PRINCIPAL */}
        <main className="min-w-0 flex-1 p-6 md:p-10">

          {/* HEADER */}
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">

            <div>
              <p className="mb-2 text-sm text-zinc-500">
                Workspace / Dashboard
              </p>

              <h2 className="text-3xl font-bold">
                Dashboard
              </h2>

              <p className="mt-2 text-zinc-400">
                Organiza os teus projetos e acompanha
                as tarefas.
              </p>
            </div>

            <button
  type="button"
  onClick={() => {
    closeModal();
    setShowModal(true);
  }}
  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
>
  <Plus size={18} />
  Nova tarefa
</button>

          </div>

          {/* ESTATÍSTICAS */}
          <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.title}
                  className="rounded-xl border border-white/10 bg-zinc-900/50 p-6"
                >
                  <div className="mb-5 flex items-center justify-between">

                    <span className="text-sm text-zinc-400">
                      {stat.title}
                    </span>

                    <Icon
                      size={20}
                      className="text-emerald-400"
                    />
                  </div>

                  <p className="text-3xl font-bold">
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>

          {/* TÍTULO DO KANBAN */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold">
              Quadro de tarefas
            </h3>

            <p className="mt-1 text-sm text-zinc-500">
              Acompanha o estado de cada tarefa.
            </p>
          </div>

          {/* KANBAN */}
          <div className="grid gap-5 lg:grid-cols-3">

            {columns.map((column) => {
              const Icon = column.icon;

              const columnTasks = tasks.filter(
                (task) => task.status === column.id
              );

              return (
                <div
                  key={column.id}
                  className="min-h-80 rounded-xl border border-white/10 bg-[#111113] p-5"
                >

                  {/* CABEÇALHO DA COLUNA */}
                  <div className="mb-6 flex items-center justify-between">

                    <div className="flex items-center gap-2">
                      <Icon
                        size={18}
                        className="text-emerald-400"
                      />

                      <h4 className="font-semibold">
                        {column.title}
                      </h4>
                    </div>

                    <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-zinc-400">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* TAREFAS */}
                  <div className="space-y-3">

                    {columnTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-lg border border-white/10 bg-zinc-900 p-4"
                      >

                        <div className="mb-3 flex items-center justify-between">

                          <span className="text-xs text-emerald-400">
                            TASK-{task.id}
                          </span>

                          <span
                            className={`rounded-md px-2 py-1 text-xs ${
                              task.priority === "Alta"
                                ? "bg-red-500/10 text-red-400"
                                : task.priority === "Média"
                                ? "bg-yellow-500/10 text-yellow-400"
                                : "bg-green-500/10 text-green-400"
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        <h5 className="mb-2 text-sm font-semibold">
                          {task.title}
                        </h5>


<div className="mb-3 flex justify-end gap-2">
  <button
    type="button"
    onClick={() => editTask(task)}
    title="Editar tarefa"
    aria-label={`Editar ${task.title}`}
    className="rounded-md p-2 text-zinc-400 transition hover:bg-white/10 hover:text-emerald-400"
  >
    <Pencil size={15} />
  </button>

  <button
    type="button"
    onClick={() => deleteTask(task.id)}
    title="Eliminar tarefa"
    aria-label={`Eliminar ${task.title}`}
    className="rounded-md p-2 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400"
  >
    <Trash2 size={15} />
  </button>
</div>


                        <p className="mb-4 text-xs leading-5 text-zinc-500">
                          {task.description}
                        </p>


<div className="mb-4">
  <label
    htmlFor={`status-${task.id}`}
    className="mb-2 block text-xs text-zinc-500"
  >
    Estado
  </label>

  <select
    id={`status-${task.id}`}
    value={task.status}
    onChange={(e) =>
      updateTaskStatus(
        task.id,
        e.target.value as TaskStatus
      )
    }
    className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500"
  >
    <option value="todo">To Do</option>
    <option value="progress">In Progress</option>
    <option value="done">Done</option>
  </select>
</div>

                        <div className="flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-zinc-500">
                          <CalendarDays size={14} />
                          Sem prazo definido
                        </div>

                      </div>
                    ))}

                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* MODAL PARA CRIAR TAREFAS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#18181b] p-6 shadow-2xl"
          >

            {/* CABEÇALHO DO MODAL */}
            <div className="mb-6 flex items-center justify-between">

              <h2
  id="new-task-title"
  className="text-xl font-bold"
>
  {editingTaskId !== null
    ? "Editar tarefa"
    : "Criar nova tarefa"}
</h2>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Fechar formulário"
                className="text-zinc-400 transition hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* FORMULÁRIO */}
            <form
              onSubmit={addTask}
              className="space-y-5"
            >

              {/* TÍTULO */}
              <div>
                <label
                  htmlFor="task-title"
                  className="mb-2 block text-sm text-zinc-300"
                >
                  Título
                </label>

                <input
                  id="task-title"
                  type="text"
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  placeholder="Ex: Criar página de login"
                  required
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* DESCRIÇÃO */}
              <div>
                <label
                  htmlFor="task-description"
                  className="mb-2 block text-sm text-zinc-300"
                >
                  Descrição
                </label>

                <textarea
                  id="task-description"
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Descreve a tarefa..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* PRIORIDADE */}
              <div>
                <label
                  htmlFor="task-priority"
                  className="mb-2 block text-sm text-zinc-300"
                >
                  Prioridade
                </label>

                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) =>
                    setPriority(
                      e.target.value as TaskPriority
                    )
                  }
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-500"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>

              {/* BOTÕES */}
              <div className="flex justify-end gap-3 pt-3">

                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm text-zinc-300 transition hover:bg-white/5"
                >
                  Cancelar
                </button>

                <button
  type="submit"
  className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
>
  {editingTaskId !== null
    ? "Guardar alterações"
    : "Criar tarefa"}
</button>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
