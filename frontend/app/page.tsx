
"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  ListChecks,
  LogOut,
  Settings,
  Plus,
  Circle,
  Clock3,
  CheckCircle2,
  CalendarDays,
  X,
  UserRound,
} from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api";
import { getProfile, logout, type Profile, type User } from "@/lib/auth-api";
import { LanguageContext, localizeError, priorityLabel, useLanguage } from "@/lib/language";
import { startLiveRefresh } from "@/lib/live-refresh";
import {
  acceptInvitation, getProject, listProjectMembers, listProjects, removeProject, saveProject, sendInvitation,
  type Project, type ProjectInput, type ProjectMember,
} from "@/lib/projects-api";
import {
  getTask,
  listTasks,
  removeTask,
  saveTask,
  updateTaskWorkflow,
  type Task,
  type TaskInput,
  type TaskPriority,
} from "@/lib/tasks-api";
import { AuthForm } from "./auth-form";
import { ActivityCalendar } from "./activity-calendar";
import { DashboardOverview } from "./dashboard-overview";
import { NotificationCenter } from "./notification-center";
import type { TaskNotification } from "@/lib/notifications-api";
import { ProjectsPanel } from "./projects-panel";
import { SettingsPanel } from "./settings-panel";
import { TaskDetails } from "./task-details";
import { MyTasks } from "./my-tasks";
import { defaultTaskFilters, filterTasks, TaskFilters } from "./task-filters";

const sections = [
  { id: "dashboard", title: "Dashboard", englishTitle: "Dashboard", icon: LayoutDashboard },
  { id: "projects", title: "Projetos", englishTitle: "Projects", icon: FolderKanban },
  { id: "tasks", title: "Tarefas", englishTitle: "Tasks", icon: ListTodo },
  { id: "my-tasks", title: "As minhas tarefas", englishTitle: "My tasks", icon: ListChecks },
  { id: "settings", title: "Definições", englishTitle: "Settings", icon: Settings },
] as const;
type Section = (typeof sections)[number]["id"];

const priorityStyles: Record<TaskPriority, string> = {
  Alta: "bg-red-500/10 text-danger",
  Média: "bg-yellow-500/10 text-warning",
  Baixa: "bg-green-500/10 text-positive",
};

const columns = [
  {
    id: "todo",
    title: "Por fazer",
    englishTitle: "To Do",
    icon: Circle,
  },
  {
    id: "progress",
    title: "Em progresso",
    englishTitle: "In Progress",
    icon: Clock3,
  },
  {
    id: "done",
    title: "Concluídas",
    englishTitle: "Done",
    icon: CheckCircle2,
  },
] as const;

type Session =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "signed-out"; notice?: string }
  | { state: "signed-in"; user: User };

type Appearance = Pick<Profile, "theme" | "language">;

const defaultAppearance: Appearance = { theme: "dark", language: "pt" };
const appearanceKey = "taskflow-appearance";

function readAppearance(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem(appearanceKey) ?? "null");
    return {
      theme: saved?.theme === "light" || saved?.theme === "system" ? saved.theme : "dark",
      language: saved?.language === "en" ? "en" : "pt",
    };
  } catch {
    return defaultAppearance;
  }
}

export default function Home() {
  const [preferences, setPreferences] = useState(defaultAppearance);

  const applyAppearance = useCallback(({ theme, language }: Appearance) => {
    setPreferences({ theme, language });
    try {
      localStorage.setItem(appearanceKey, JSON.stringify({ theme, language }));
    } catch {
      // The account still supplies preferences when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.lang = preferences.language === "pt" ? "pt-PT" : "en";
  }, [preferences.theme, preferences.language]);

  return (
    <LanguageContext.Provider value={preferences.language}>
      <SessionView onPreferences={applyAppearance} />
    </LanguageContext.Provider>
  );
}

function SessionView({ onPreferences }: { onPreferences: (preferences: Appearance) => void }) {
  const { t, language } = useLanguage();
  const [session, setSession] = useState<Session>({ state: "loading" });
  const [sessionAttempt, setSessionAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getProfile(controller.signal)
      .then((user) => {
        if (controller.signal.aborted) return;
        onPreferences(user);
        setSession({ state: "signed-in", user });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          onPreferences(readAppearance());
          setSession({ state: "signed-out" });
        } else {
          setSession({ state: "error", message: errorMessage(error) });
        }
      });
    return () => controller.abort();
  }, [sessionAttempt, onPreferences]);

  function checkSession() {
    setSession({ state: "loading" });
    setSessionAttempt((attempt) => attempt + 1);
  }

  const sessionExpired = useCallback(() => {
    setSession({ state: "signed-out", notice: "A sessão expirou. Inicia sessão novamente." });
  }, []);

  if (session.state === "signed-out") {
    return <AuthForm notice={session.notice ? localizeError(session.notice, language) : undefined} onLogin={checkSession} />;
  }
  if (session.state === "signed-in") {
    return (
      <Dashboard
        key={session.user.id}
        user={session.user}
        onUnauthorized={sessionExpired}
        onProfile={(user) => {
          onPreferences(user);
          setSession({ state: "signed-in", user });
        }}
        onCredentialsChanged={() => {
          setSession({ state: "signed-out", notice: "Credenciais atualizadas. Inicia sessão novamente." });
        }}
        onLogout={async () => {
          await logout();
          setSession({ state: "signed-out" });
        }}
      />
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      {session.state === "loading" ? (
        <p role="status">{t("A verificar a sessão…", "Checking your session…")}</p>
      ) : (
        <div className="space-y-4">
          <p role="alert" className="text-danger">{localizeError(session.message, language)}</p>
          <button type="button" onClick={checkSession} className="text-accent underline">
            {t("Tentar novamente", "Try again")}
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
  onProfile,
  onCredentialsChanged,
}: {
  user: User;
  onUnauthorized: () => void;
  onLogout: () => Promise<void>;
  onProfile: (user: User) => void;
  onCredentialsChanged: () => void;
}) {
  const { t, language } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ProjectMember[] | null>(null);
  const [membersError, setMembersError] = useState("");
  const [filters, setFilters] = useState(defaultTaskFilters);
  const [section, setSection] = useState<Section>("dashboard");
  const [taskProjectId, setTaskProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasLoaded = useRef(false);
  const saving = useRef(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (isSaving) return;
    return startLiveRefresh(async (signal) => {
      if (saving.current) return;
      try {
        const [loadedTasks, loadedProjects] = await Promise.all([listTasks(signal), listProjects(signal)]);
        if (signal.aborted || saving.current) return;
        setTasks(loadedTasks);
        setProjects(loadedProjects);
        hasLoaded.current = true;
        setLoadError("");
      } catch (error) {
        if (signal.aborted || saving.current) return;
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
        } else if (!hasLoaded.current) {
          setLoadError(errorMessage(error));
        }
      } finally {
        if (!signal.aborted && !saving.current) setIsLoading(false);
      }
    });
  }, [isSaving, loadAttempt, onUnauthorized]);

  useEffect(() => {
    if (section !== "tasks" && section !== "my-tasks") return;
    return startLiveRefresh(async (signal) => {
      try {
        const result = await listProjectMembers(signal);
        if (!signal.aborted) {
          setMembers(result);
          setMembersError("");
        }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
        } else {
          setMembersError(errorMessage(error));
        }
      }
    });
  }, [section, taskProjectId, loadAttempt, onUnauthorized]);

  // Estado do formulário
  const [showModal, setShowModal] = useState(false);
  const [detailsTaskId, setDetailsTaskId] = useState<number | null>(null);
  const detailsTask = tasks.find((task) => task.id === detailsTaskId);
  const [title, setTitle] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const editingTask = tasks.find((task) => task.id === editingTaskId);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] =
    useState<TaskPriority>("Média");

  function setSaving(value: boolean) {
    saving.current = value;
    setIsSaving(value);
  }

  async function runMutation(action: () => Promise<void>, success: string) {
    if (saving.current) return false;

    setSaving(true);
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
      setSaving(false);
    }
  }

  function navigate(nextSection: Section, nextProjectId: string | null = null) {
    setDetailsTaskId(null);
    setFeedback(null);
    setSection(nextSection);
    setTaskProjectId(nextProjectId);
    if (nextSection === "tasks") setFilters(defaultTaskFilters);
    window.scrollTo({ top: 0 });
  }

  function viewProjectTasks(id: string) {
    navigate("tasks", id);
  }

  function openTaskDetails(id: number) {
    setFeedback(null);
    setDetailsTaskId(id);
  }

  function submitProject(input: ProjectInput, id?: string) {
    return runMutation(async () => {
      const saved = await saveProject(input, id);
      setProjects((previous) => [
        ...previous.filter((project) => project.id !== saved.id),
        saved,
      ].sort((left, right) => left.name.localeCompare(right.name, "pt-PT")));
    }, id ? t("Projeto atualizado.", "Project updated.") : t("Projeto criado.", "Project created."));
  }

  function refreshWorkspace() {
    setLoadError("");
    setIsLoading(true);
    setLoadAttempt((attempt) => attempt + 1);
  }

  function joinProject(id: string, projectId: string) {
    return runMutation(async () => {
      await acceptInvitation(id);
      viewProjectTasks(projectId);
      refreshWorkspace();
    }, t("Convite aceite.", "Invitation accepted."));
  }

  async function openNotification(notification: TaskNotification) {
    if (notification.task_id !== null) {
      let task: Task | undefined;
      try {
        task = await getTask(notification.task_id);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
        setTasks((previous) => previous.filter((item) => item.id !== notification.task_id));
      }
      if (task) {
        setTasks((previous) => [...previous.filter((item) => item.id !== task.id), task].sort((a, b) => a.id - b.id));
        navigate("tasks", task.project_id);
        setDetailsTaskId(task.id);
        return;
      }
    }
    if (notification.project_id !== null) {
      const project = await getProject(notification.project_id);
      setProjects((previous) => [...previous.filter((item) => item.id !== project.id), project]
        .sort((a, b) => a.name.localeCompare(b.name, "pt-PT")));
      viewProjectTasks(project.id);
      refreshWorkspace();
      return;
    }
    throw new Error(t("A tarefa já não está disponível.", "This task is no longer available."));
  }

  function deleteProject(project: Project) {
    if (!window.confirm(t(
      `Eliminar «${project.name}»? As tarefas associadas ficam sem projeto.`,
      `Delete “${project.name}”? Its tasks will no longer be assigned to this project.`,
    ))) return;

    return runMutation(async () => {
      await removeProject(project.id);
      setProjects((previous) => previous.filter((item) => item.id !== project.id));
      setTasks((previous) => previous
        .filter((task) => task.project_id !== project.id || task.is_owner)
        .map((task) => {
          if (task.project_id !== project.id) return task;
          const assignee_id = task.assignee_id === user.id ? user.id : null;
          const status = task.status === "progress" && !assignee_id ? "todo" : task.status;
          return { ...task, project_id: null, assignee_id, status };
        }));
    }, t("Projeto eliminado.", "Project deleted."));
  }

  function applyUpdatedTask(updated: Task) {
    setTasks((previous) => previous.map((task) => task.id === updated.id ? updated : task));
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setFeedback({ type: "error", text: t("Introduz um título para a tarefa.", "Enter a task title.") });
      return;
    }

    const existing = editingTask;
    if (editingTaskId !== null && !existing) {
      setFeedback({ type: "error", text: t("A tarefa já não está disponível.", "This task is no longer available.") });
      return;
    }
    const input = {
      title: title.trim(),
      description: description.trim(),
      priority,
      ...(!existing || existing.is_owner ? { project_id: projectId || null } : {}),
      due_date: dueDate || null,
    } satisfies TaskInput;

    return runMutation(async () => {
      const saved = await saveTask(input, existing?.id);
      if (existing) {
        applyUpdatedTask(saved);
      } else {
        setTasks((previous) => [...previous, saved]);
      }
      closeModal();
    }, existing ? t("Alterações guardadas.", "Changes saved.") : t("Tarefa criada.", "Task created."));
  }

  function changeTaskWorkflow(id: number, change: Parameters<typeof updateTaskWorkflow>[1]) {
    return runMutation(async () => {
      const updated = await updateTaskWorkflow(id, change);
      applyUpdatedTask(updated);
    }, t("Tarefa atualizada.", "Task updated."));
  }

  function editTask(task: Task) {
    setFeedback(null);
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setProjectId(task.project_id ?? "");
    setDueDate(task.due_date ?? "");
    setShowModal(true);
  }

  function deleteTask(taskId: number) {
    if (!window.confirm(t("Tens a certeza de que queres eliminar esta tarefa?", "Delete this task?"))) return;

    return runMutation(async () => {
      await removeTask(taskId);
      setTasks((previous) => previous.filter((task) => task.id !== taskId));
      setDetailsTaskId((previous) => previous === taskId ? null : previous);
    }, t("Tarefa eliminada.", "Task deleted."));
  }

  function closeModal() {
    setFeedback(null);
    setShowModal(false);
    setEditingTaskId(null);
    setTitle("");
    setDescription("");
    setPriority("Média");
    setProjectId("");
    setDueDate("");
  }

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const membersByProject = new Map<string, ProjectMember[]>();
  for (const member of members ?? []) {
    const participants = membersByProject.get(member.project_id);
    if (participants) participants.push(member);
    else membersByProject.set(member.project_id, [member]);
  }
  const personalAssignee = { id: user.id, name: user.display_name || t("Eu", "Me") };
  function taskParticipants(task: Task) {
    return task.project_id ? membersByProject.get(task.project_id) ?? [] : [personalAssignee];
  }
  function taskAssigneeName(task: Task) {
    if (!task.assignee_id) return t("Sem responsável", "Unassigned");
    return taskParticipants(task).find((participant) => participant.id === task.assignee_id)?.name
      ?? t("Responsável atual", "Current assignee");
  }
  const currentSection = sections.find((item) => item.id === section)!;
  const sectionTitle = t(currentSection.title, currentSection.englishTitle);
  const taskProjectName = taskProjectId === null ? undefined : projectNames.get(taskProjectId);
  const sectionTasks = taskProjectId === null ? tasks : tasks.filter((task) => task.project_id === taskProjectId);
  const visibleTasks = filterTasks(sectionTasks, filters);
  const localizedColumns = columns.map((column) => ({ ...column, title: t(column.title, column.englishTitle) }));

  // Estatísticas
  const stats = [
    {
      title: t("Total de tarefas", "Total tasks"),
      value: visibleTasks.length,
      icon: ListTodo,
    },
    {
      title: t("Por fazer", "To do"),
      value: visibleTasks.filter(
        (task) => task.status === "todo"
      ).length,
      icon: Circle,
    },
    {
      title: t("Em progresso", "In progress"),
      value: visibleTasks.filter(
        (task) => task.status === "progress"
      ).length,
      icon: Clock3,
    },
    {
      title: t("Concluídas", "Completed"),
      value: visibleTasks.filter(
        (task) => task.status === "done"
      ).length,
      icon: CheckCircle2,
    },
  ];

  const signOutButton = (
    <button
      type="button"
      disabled={isSaving}
      onClick={() => runMutation(onLogout, t("Sessão terminada.", "Signed out."))}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-muted hover:bg-tint hover:text-foreground disabled:opacity-50"
    >
      <LogOut size={18} aria-hidden="true" />
      {t("Terminar sessão", "Sign out")}
    </button>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">

        {/* SIDEBAR */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col self-start overflow-y-auto border-r border-line bg-panel p-6 md:flex">

          <h1 className="mb-12 text-2xl font-bold">
            Task
            <span className="text-accent">
              Flow.
            </span>
          </h1>

          <nav className="space-y-2">
            {sections.map(({ id, title, englishTitle, icon: Icon }) => (
              <button
                key={id} type="button"
                aria-current={section === id ? "page" : undefined}
                disabled={isSaving} onClick={() => navigate(id)}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-muted hover:bg-tint hover:text-foreground aria-[current=page]:bg-emerald-500/10 aria-[current=page]:text-accent"
              >
                <Icon size={18} aria-hidden="true" />
                {t(title, englishTitle)}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-3 border-t border-line pt-4">
            {signOutButton}
            <p className="px-4 text-xs text-subtle">TaskFlow v1.0</p>
          </div>
        </aside>

        {/* CONTEÚDO PRINCIPAL */}
        <main className="relative min-w-0 flex-1 p-6 md:p-10">
          <div className="absolute right-6 top-6 md:right-10 md:top-10">
            <NotificationCenter onAccept={joinProject} onOpen={openNotification} onUnauthorized={onUnauthorized} disabled={isSaving} />
          </div>
          <nav aria-label={t("Secções", "Sections")} className="mb-6 flex flex-wrap gap-3 pr-14 md:hidden">
            {sections.map(({ id, title, englishTitle }) => (
              <button
                key={id} type="button" aria-current={section === id ? "page" : undefined}
                disabled={isSaving} onClick={() => navigate(id)}
                className="rounded-lg border border-line px-3 py-2 text-sm aria-[current=page]:text-accent"
              >
                {t(title, englishTitle)}
              </button>
            ))}
          </nav>

          {/* HEADER */}
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4 md:pr-14">

            <div>
              <p className="mb-2 text-sm text-subtle">
                {t("Área de trabalho", "Workspace")} / {sectionTitle}
              </p>

              <h2 className="text-3xl font-bold">
                {taskProjectName ? t(`Tarefas de ${taskProjectName}`, `Tasks for ${taskProjectName}`) : sectionTitle}
              </h2>

              {section === "dashboard" && <p className="mt-2 text-muted">
                {t("Organiza os teus projetos e acompanha as tarefas.", "Organise your projects and track your tasks.")}
              </p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {user.display_name && <span className="break-all text-sm text-muted">{user.display_name}</span>}
            {section === "tasks" && <button
  type="button"
  disabled={isLoading || Boolean(loadError) || isSaving}
  onClick={() => {
    closeModal();
    setProjectId(taskProjectId ?? "");
    setShowModal(true);
  }}
  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
>
  <Plus size={18} />
  {t("Nova tarefa", "New task")}
</button>}
            </div>

          </div>

          {isLoading && <p role="status" className="mb-6 text-muted">{t("A carregar tarefas e projetos…", "Loading tasks and projects…")}</p>}
          {loadError && (
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <p role="alert" className="text-danger">{localizeError(loadError, language)}</p>
              <button
                type="button"
                className="rounded-lg border border-line-strong px-3 py-2 text-sm"
                onClick={() => {
                  setLoadError("");
                  setIsLoading(true);
                  setLoadAttempt((attempt) => attempt + 1);
                }}
              >
                {t("Tentar novamente", "Try again")}
              </button>
            </div>
          )}
          {!showModal && !detailsTask && isSaving && (
            <p role="status" className="mb-6 text-muted">{t("A guardar alterações…", "Saving changes…")}</p>
          )}
          {!showModal && !detailsTask && feedback && (
            <p
              role={feedback.type === "error" ? "alert" : "status"}
              className={feedback.type === "error" ? "mb-6 text-danger" : "mb-6 text-accent"}
            >
              {localizeError(feedback.text, language)}
            </p>
          )}

          {section === "settings" ? (
            <SettingsPanel
              user={user} onProfile={onProfile} onCredentialsChanged={onCredentialsChanged}
              onUnauthorized={onUnauthorized} onBusy={setSaving}
            />
          ) : section === "projects" ? (
            !isLoading && !loadError && (
              <ProjectsPanel
                projects={projects}
                isSaving={isSaving}
                onSave={submitProject}
                onDelete={deleteProject}
                onInvite={(id, email) => runMutation(() => sendInvitation(id, email), t("Convite criado.", "Invitation sent."))}
                onViewTasks={viewProjectTasks}
                onClearFeedback={() => setFeedback(null)}
              />
            )
          ) : section === "my-tasks" ? (
            !isLoading && !loadError && (
              <MyTasks
                tasks={tasks.filter((task) => task.assignee_id === user.id)}
                projectNames={projectNames}
                onOpen={openTaskDetails}
              />
            )
          ) : section === "dashboard" ? (
          !isLoading && !loadError && (
            <>
              <DashboardOverview
                projects={projects}
                tasks={tasks}
                onViewTasks={viewProjectTasks}
              />
              <ActivityCalendar onUnauthorized={onUnauthorized} />
            </>
          )
          ) : (
          <>
          <TaskFilters
            filters={filters}
            onChange={setFilters}
            columns={localizedColumns}
            disabled={isLoading || Boolean(loadError) || isSaving}
          />

          {/* ESTATÍSTICAS */}
          <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.title}
                  className="rounded-xl border border-line bg-panel p-6"
                >
                  <div className="mb-5 flex items-center justify-between">

                    <span className="text-sm text-muted">
                      {stat.title}
                    </span>

                    <Icon
                      size={20}
                      className="text-accent"
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
              {t("Quadro de tarefas", "Task board")}
            </h3>

            <p className="mt-1 text-sm text-subtle">
              {t("Cada pessoa pode ter até cinco tarefas em progresso.", "Each person can have up to five tasks in progress.")}
            </p>
            {membersError && <p role="alert" className="mt-2 text-sm text-danger">{localizeError(membersError, language)}</p>}
          </div>

          {/* KANBAN */}
          <div className="grid gap-5 lg:grid-cols-3">

            {localizedColumns.map((column) => {
              const Icon = column.icon;

              const columnTasks = visibleTasks.filter(
                (task) => task.status === column.id
              );

              return (
                <div
                  key={column.id}
                  className="min-h-80 rounded-xl border border-line bg-panel p-5"
                >

                  {/* CABEÇALHO DA COLUNA */}
                  <div className="mb-6 flex items-center justify-between">

                    <div className="flex items-center gap-2">
                      <Icon
                        size={18}
                        className="text-accent"
                      />

                      <h4 className="font-semibold">
                        {column.title}
                      </h4>
                    </div>

                    <span className="rounded-md bg-tint px-2 py-1 text-xs text-muted">
                      {isLoading || loadError ? "—" : columnTasks.length}
                    </span>
                  </div>

                  {/* TAREFAS */}
                  <div className="space-y-2">
                    {!isLoading && !loadError && columnTasks.length === 0 && (
                      <p className="text-sm text-muted">{t("Sem tarefas nesta coluna.", "No tasks in this column.")}</p>
                    )}

                    {columnTasks.map((task) => (
                      <button
                        key={task.id} type="button" aria-label={task.title}
                        aria-describedby={`task-summary-${task.id} task-priority-${task.id}`}
                        onClick={() => openTaskDetails(task.id)}
                        className="block w-full rounded-lg border border-line bg-field px-3 py-2.5 text-left transition hover:border-emerald-500/40 hover:bg-tint focus-visible:outline-2 focus-visible:outline-emerald-500"
                      >
                        <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                          <span className="min-w-0 break-words text-sm font-semibold">{task.title}</span>
                          <span id={`task-priority-${task.id}`} className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs ${priorityStyles[task.priority]}`}>
                            {priorityLabel(task.priority, language)}
                          </span>
                        </span>
                        <span id={`task-summary-${task.id}`} className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span className="flex min-w-0 items-center gap-1">
                            <UserRound size={13} aria-hidden="true" className="shrink-0" />
                            <span className="break-all">{taskAssigneeName(task)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarDays size={13} aria-hidden="true" />
                            {task.due_date
                              ? <time dateTime={task.due_date}>{task.due_date.split("-").reverse().join("/")}</time>
                              : t("Sem prazo", "No due date")}
                          </span>
                        </span>
                      </button>
                    ))}

                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}
          <footer className="mt-8 border-t border-line pt-3 md:hidden">
            {signOutButton}
          </footer>
        </main>
      </div>

      {detailsTask && (
        <TaskDetails
          task={detailsTask}
          status={localizedColumns.find((column) => column.id === detailsTask.status)?.title ?? detailsTask.status}
          project={detailsTask.project_id ? projectNames.get(detailsTask.project_id) : undefined}
          participants={taskParticipants(detailsTask)}
          busy={isSaving || isLoading}
          assignmentUnavailable={Boolean(detailsTask.project_id && (!members || membersError))}
          feedback={feedback}
          onAssign={(id) => changeTaskWorkflow(detailsTask.id, { assignee_id: id })}
          onComplete={(completed) => changeTaskWorkflow(detailsTask.id, { completed })}
          onEdit={() => {
            setDetailsTaskId(null);
            editTask(detailsTask);
          }}
          onDelete={() => deleteTask(detailsTask.id)}
          onClose={() => setDetailsTaskId(null)}
        />
      )}

      {/* MODAL PARA CRIAR TAREFAS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-dialog p-6 shadow-2xl"
          >

            {/* CABEÇALHO DO MODAL */}
            <div className="mb-6 flex items-center justify-between">

              <h2
  id="new-task-title"
  className="text-xl font-bold"
>
  {editingTaskId !== null
    ? t("Editar tarefa", "Edit task")
    : t("Criar nova tarefa", "Create a new task")}
</h2>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                aria-label={t("Fechar formulário", "Close form")}
                className="text-muted transition hover:text-foreground"
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
                <p role="alert" className="text-sm text-danger">{localizeError(feedback.text, language)}</p>
              )}

              {/* TÍTULO */}
              <div>
                <label
                  htmlFor="task-title"
                  className="mb-2 block text-sm text-muted"
                >
                  {t("Título", "Title")}
                </label>

                <input
                  id="task-title"
                  type="text"
                  value={title}
                  disabled={isSaving}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  placeholder={t("Ex: Criar página de login", "E.g. Create a sign-in page")}
                  required
                  className="w-full rounded-lg border border-line bg-field px-4 py-3 text-foreground outline-none focus:border-emerald-500"
                />
              </div>

              {/* DESCRIÇÃO */}
              <div>
                <label
                  htmlFor="task-description"
                  className="mb-2 block text-sm text-muted"
                >
                  {t("Descrição", "Description")}
                </label>

                <textarea
                  id="task-description"
                  value={description}
                  disabled={isSaving}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder={t("Descreve a tarefa…", "Describe the task…")}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-line bg-field px-4 py-3 text-foreground outline-none focus:border-emerald-500"
                />
              </div>

              {/* PRIORIDADE */}
              <div>
                <label
                  htmlFor="task-priority"
                  className="mb-2 block text-sm text-muted"
                >
                  {t("Prioridade", "Priority")}
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
                  className="w-full rounded-lg border border-line bg-field px-4 py-3 text-foreground outline-none focus:border-emerald-500"
                >
                  {(["Baixa", "Média", "Alta"] as const).map((value) => (
                    <option key={value} value={value}>{priorityLabel(value, language)}</option>
                  ))}
                </select>
              </div>

              {(!editingTask || editingTask.is_owner) && <div>
                <label htmlFor="task-project" className="mb-2 block text-sm text-muted">{t("Projeto", "Project")}</label>
                <select
                  id="task-project"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  disabled={isSaving}
                  className="w-full rounded-lg border border-line bg-field px-4 py-3 text-foreground"
                >
                  <option value="">{t("Sem projeto", "No project")}</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </div>}

              <div>
                <label htmlFor="task-due-date" className="mb-2 block text-sm text-muted">{t("Data de entrega", "Due date")}</label>
                <input
                  id="task-due-date" type="date" min="0001-01-01" max="9999-12-31"
                  value={dueDate} disabled={isSaving}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="w-full rounded-lg border border-line bg-field px-4 py-3 text-foreground"
                />
              </div>

              {/* BOTÕES */}
              <div className="flex justify-end gap-3 pt-3">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded-lg border border-line px-5 py-3 text-sm text-muted transition hover:bg-tint"
                >
                  {t("Cancelar", "Cancel")}
                </button>

                <button
  type="submit"
  disabled={isSaving}
  className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
>
  {isSaving ? t("A guardar…", "Saving…") : editingTaskId !== null
    ? t("Guardar alterações", "Save changes")
    : t("Criar tarefa", "Create task")}
</button>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
