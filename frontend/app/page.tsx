
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
import { ApiError, errorMessage } from "@/lib/api";
import { getProfile, logout, type User } from "@/lib/auth-api";
import { listProjects, removeProject, saveProject, type Project, type ProjectInput } from "@/lib/projects-api";
import {
  listTasks,
  removeTask,
  saveTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks-api";
import { AuthForm } from "./auth-form";
import { ProjectsPanel } from "./projects-panel";

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

type Session =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "signed-out"; notice?: string }
  | { state: "signed-in"; user: User };

export default function Home() {
  const [session, setSession] = useState<Session>({ state: "loading" });
  const [sessionAttempt, setSessionAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getProfile(controller.signal)
      .then((user) => {
        if (!controller.signal.aborted) setSession({ state: "signed-in", user });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          setSession({ state: "signed-out" });
        } else {
          setSession({ state: "error", message: errorMessage(error) });
        }
      });
    return () => controller.abort();
  }, [sessionAttempt]);

  function checkSession() {
    setSession({ state: "loading" });
    setSessionAttempt((attempt) => attempt + 1);
  }

  const sessionExpired = useCallback(() => {
    setSession({ state: "signed-out", notice: "A sessão expirou. Inicia sessão novamente." });
  }, []);

  if (session.state === "signed-out") {
    return <AuthForm notice={session.notice} onLogin={checkSession} />;
  }
  if (session.state === "signed-in") {
    return (
      <Dashboard
        key={session.user.id}
        user={session.user}
        onUnauthorized={sessionExpired}
        onLogout={async () => {
          await logout();
          setSession({ state: "signed-out" });
        }}
      />
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#09090b] p-6 text-white">
      {session.state === "loading" ? (
        <p role="status">A verificar a sessão…</p>
      ) : (
        <div className="space-y-4">
          <p role="alert" className="text-red-400">{session.message}</p>
          <button type="button" onClick={checkSession} className="text-emerald-400 underline">
            Tentar novamente
          </button>
        </div>
      )}
    </main>
  );
}

function Dashboard({
  user,
  onUnauthorized,
  onLogout,
}: {
  user: User;
  onUnauthorized: () => void;
  onLogout: () => Promise<void>;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState("all");
  const [section, setSection] = useState<"dashboard" | "projects">("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([listTasks(controller.signal), listProjects(controller.signal)])
      .then(([loadedTasks, loadedProjects]) => {
        if (controller.signal.aborted) return;
        setTasks(loadedTasks);
        setProjects(loadedProjects);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
        } else {
          setLoadError(errorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [loadAttempt, onUnauthorized]);

  // Estado do formulário
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] =
    useState<TaskPriority>("Média");

  async function runMutation(action: () => Promise<void>, success: string) {
    if (isSaving) return false;

    setIsSaving(true);
    setFeedback(null);
    try {
      await action();
      setFeedback({ type: "success", text: success });
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
      } else {
        setFeedback({ type: "error", text: errorMessage(error) });
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function navigate(nextSection: typeof section) {
    setFeedback(null);
    setSection(nextSection);
  }

  function submitProject(input: ProjectInput, id?: string) {
    return runMutation(async () => {
      const saved = await saveProject(input, id);
      setProjects((previous) => [
        ...previous.filter((project) => project.id !== saved.id),
        saved,
      ].sort((left, right) => left.name.localeCompare(right.name, "pt-PT")));
    }, id ? "Projeto atualizado." : "Projeto criado.");
  }

  function deleteProject(project: Project) {
    if (!window.confirm(`Eliminar «${project.name}»? As tarefas associadas ficam sem projeto.`)) return;

    return runMutation(async () => {
      await removeProject(project.id);
      setProjects((previous) => previous.filter((item) => item.id !== project.id));
      setTasks((previous) => previous.map((task) =>
        task.project_id === project.id ? { ...task, project_id: null } : task
      ));
      setProjectFilter((previous) => previous === project.id ? "" : previous);
    }, "Projeto eliminado.");
  }

  function applyUpdatedTask(updated: Task) {
    setTasks((previous) => previous.map((task) => task.id === updated.id ? updated : task));
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setFeedback({ type: "error", text: "Introduz um título para a tarefa." });
      return;
    }

    const existing = tasks.find((task) => task.id === editingTaskId);
    const input = {
      title: title.trim(),
      description: description.trim(),
      priority,
      status: existing?.status ?? "todo",
      project_id: projectId || null,
    } satisfies Omit<Task, "id">;

    return runMutation(async () => {
      const saved = await saveTask(input, existing?.id);
      if (existing) {
        applyUpdatedTask(saved);
      } else {
        setTasks((previous) => [...previous, saved]);
      }
      closeModal();
    }, existing ? "Alterações guardadas." : "Tarefa criada.");
  }

  function updateTaskStatus(task: Task, status: TaskStatus) {
    const { id, title, description, priority } = task;

    return runMutation(async () => {
      const updated = await saveTask({ title, description, priority, status }, id);
      applyUpdatedTask(updated);
    }, "Estado atualizado.");
  }

  function editTask(task: Task) {
    setFeedback(null);
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setProjectId(task.project_id ?? "");
    setShowModal(true);
  }

  function deleteTask(taskId: number) {
    if (!window.confirm("Tens a certeza de que queres eliminar esta tarefa?")) return;

    return runMutation(async () => {
      await removeTask(taskId);
      setTasks((previous) => previous.filter((task) => task.id !== taskId));
    }, "Tarefa eliminada.");
  }

  function closeModal() {
    setFeedback(null);
    setShowModal(false);
    setEditingTaskId(null);
    setTitle("");
    setDescription("");
    setPriority("Média");
    setProjectId("");
  }

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const visibleTasks = projectFilter === "all"
    ? tasks
    : tasks.filter((task) => (task.project_id ?? "") === projectFilter);

  // Estatísticas
  const stats = [
    {
      title: "Total de tarefas",
      value: visibleTasks.length,
      icon: ListTodo,
    },
    {
      title: "Por fazer",
      value: visibleTasks.filter(
        (task) => task.status === "todo"
      ).length,
      icon: Circle,
    },
    {
      title: "Em progresso",
      value: visibleTasks.filter(
        (task) => task.status === "progress"
      ).length,
      icon: Clock3,
    },
    {
      title: "Concluídas",
      value: visibleTasks.filter(
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
                target: "dashboard",
              },
              {
                name: "Projetos",
                icon: FolderKanban,
                target: "projects",
              },
              {
                name: "Tarefas",
                icon: ListTodo,
              },
              {
                name: "Definições",
                icon: Settings,
              },
            ].map((item) => {
              const Icon = item.icon;
              const target = item.target === "dashboard" || item.target === "projects" ? item.target : undefined;
              const active = target === section;
              const style = `flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm ${
                active ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`;

              if (target) {
                return (
                  <button
                    key={item.name} type="button" className={style}
                    aria-current={active ? "page" : undefined}
                    disabled={isSaving} onClick={() => navigate(target)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {item.name}
                  </button>
                );
              }

              return (
                <div key={item.name} className={style}>
                  <Icon size={18} aria-hidden="true" />
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
          <nav aria-label="Secções" className="mb-6 flex gap-3 md:hidden">
            <button
              type="button" aria-current={section === "dashboard" ? "page" : undefined}
              disabled={isSaving} onClick={() => navigate("dashboard")}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm aria-[current=page]:text-emerald-400"
            >
              Dashboard
            </button>
            <button
              type="button" aria-current={section === "projects" ? "page" : undefined}
              disabled={isSaving} onClick={() => navigate("projects")}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm aria-[current=page]:text-emerald-400"
            >
              Projetos
            </button>
          </nav>

          {/* HEADER */}
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">

            <div>
              <p className="mb-2 text-sm text-zinc-500">
                Workspace / {section === "projects" ? "Projetos" : "Dashboard"}
              </p>

              <h2 className="text-3xl font-bold">
                {section === "projects" ? "Projetos" : "Dashboard"}
              </h2>

              {section === "dashboard" && <p className="mt-2 text-zinc-400">
                Organiza os teus projetos e acompanha
                as tarefas.
              </p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="break-all text-sm text-zinc-400">{user.email}</span>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => runMutation(onLogout, "Sessão terminada.")}
                className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              >
                Terminar sessão
              </button>
            {section === "dashboard" && <button
  type="button"
  disabled={isLoading || Boolean(loadError) || isSaving}
  onClick={() => {
    closeModal();
    setProjectId(projectFilter === "all" ? "" : projectFilter);
    setShowModal(true);
  }}
  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
>
  <Plus size={18} />
  Nova tarefa
</button>}
            </div>

          </div>

          {isLoading && <p role="status" className="mb-6 text-zinc-300">A carregar tarefas e projetos…</p>}
          {loadError && (
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <p role="alert" className="text-red-400">{loadError}</p>
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm"
                onClick={() => {
                  setLoadError("");
                  setIsLoading(true);
                  setLoadAttempt((attempt) => attempt + 1);
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {!showModal && isSaving && (
            <p role="status" className="mb-6 text-zinc-300">A guardar alterações…</p>
          )}
          {!showModal && feedback && (
            <p
              role={feedback.type === "error" ? "alert" : "status"}
              className={feedback.type === "error" ? "mb-6 text-red-400" : "mb-6 text-emerald-400"}
            >
              {feedback.text}
            </p>
          )}

          {section === "projects" ? (
            !isLoading && !loadError && (
              <ProjectsPanel
                projects={projects}
                isSaving={isSaving}
                onSave={submitProject}
                onDelete={deleteProject}
                onViewTasks={(id) => {
                  setProjectFilter(id);
                  navigate("dashboard");
                }}
                onClearFeedback={() => setFeedback(null)}
              />
            )
          ) : (
          <>
          <div className="mb-4 w-full max-w-xs">
            <label htmlFor="project-filter" className="mb-2 block text-sm text-zinc-300">Filtrar por projeto</label>
            <select
              id="project-filter"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              disabled={isLoading || Boolean(loadError) || isSaving}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              <option value="all">Todos os projetos</option>
              <option value="">Sem projeto</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
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
                    {isLoading || loadError ? "—" : stat.value}
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

              const columnTasks = visibleTasks.filter(
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
                      {isLoading || loadError ? "—" : columnTasks.length}
                    </span>
                  </div>

                  {/* TAREFAS */}
                  <div className="space-y-3">
                    {!isLoading && !loadError && columnTasks.length === 0 && (
                      <p className="text-sm text-zinc-400">Sem tarefas nesta coluna.</p>
                    )}

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

                        {task.project_id && projectNames.has(task.project_id) && (
                          <p className="mb-2 break-words text-xs text-zinc-400">{projectNames.get(task.project_id)}</p>
                        )}

<div className="mb-3 flex justify-end gap-2">
  <button
    type="button"
    onClick={() => editTask(task)}
    disabled={isSaving}
    title="Editar tarefa"
    aria-label={`Editar ${task.title}`}
    className="rounded-md p-2 text-zinc-400 transition hover:bg-white/10 hover:text-emerald-400"
  >
    <Pencil size={15} />
  </button>

  <button
    type="button"
    onClick={() => deleteTask(task.id)}
    disabled={isSaving}
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
    disabled={isSaving}
    onChange={(e) =>
      updateTaskStatus(
        task,
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
          </>
          )}
        </main>
      </div>

      {/* MODAL PARA CRIAR TAREFAS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#18181b] p-6 shadow-2xl"
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
                disabled={isSaving}
                aria-label="Fechar formulário"
                className="text-zinc-400 transition hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* FORMULÁRIO */}
            <form
              onSubmit={submitTask}
              className="space-y-5"
            >
              {feedback?.type === "error" && (
                <p role="alert" className="text-sm text-red-400">{feedback.text}</p>
              )}

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
                  disabled={isSaving}
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
                  disabled={isSaving}
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
                  disabled={isSaving}
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

              <div>
                <label htmlFor="task-project" className="mb-2 block text-sm text-zinc-300">Projeto</label>
                <select
                  id="task-project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  disabled={isSaving}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white"
                >
                  <option value="">Sem projeto</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </div>

              {/* BOTÕES */}
              <div className="flex justify-end gap-3 pt-3">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm text-zinc-300 transition hover:bg-white/5"
                >
                  Cancelar
                </button>

                <button
  type="submit"
  disabled={isSaving}
  className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
>
  {isSaving ? "A guardar…" : editingTaskId !== null
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
