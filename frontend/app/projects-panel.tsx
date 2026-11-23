"use client";

import { useState, type FormEvent } from "react";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import type { Project, ProjectInput } from "@/lib/projects-api";
import { useLanguage } from "@/lib/language";
import { ProjectPeople } from "./project-people";

type Props = {
  projects: Project[];
  isSaving: boolean;
  onSave: (input: ProjectInput, id?: string) => Promise<boolean>;
  onDelete: (project: Project) => void;
  onViewTasks: (id: string) => void;
  onInvite: (id: string, email: string) => Promise<boolean>;
  onClearFeedback: () => void;
};

const fieldStyle = "w-full rounded-lg border border-line bg-field px-4 py-3 text-foreground outline-none focus:border-emerald-500 disabled:opacity-50";
const primaryButton = "inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50";
const actionButton = "inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-tint disabled:opacity-50";

export function ProjectsPanel({ projects, isSaving, onSave, onDelete, onViewTasks, onInvite, onClearFeedback }: Props) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<Project | ProjectInput | null>(null);
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null);
  const [peopleProjectId, setPeopleProjectId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [validationError, setValidationError] = useState("");
  const editingId = draft && "id" in draft ? draft.id : undefined;

  function openForm(project: Project | ProjectInput) {
    onClearFeedback();
    setValidationError("");
    setDraft(project);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || isSaving) return;
    const name = draft.name.trim();
    if (!name) {
      setValidationError(t("Introduz um nome para o projeto.", "Enter a project name."));
      return;
    }

    setValidationError("");
    if (await onSave({ name, description: draft.description.trim() }, editingId)) {
      setDraft(null);
    }
  }

  return (
    <section aria-label={t("Gestão de projetos", "Project management")} className="space-y-5">
      {draft ? (
        <form onSubmit={submit} className="max-w-xl space-y-4 rounded-xl border border-line bg-panel p-5">
          <h3 className="text-lg font-semibold">{editingId ? t("Editar projeto", "Edit project") : t("Novo projeto", "New project")}</h3>
          {validationError && <p role="alert" className="text-sm text-danger">{validationError}</p>}
          <div>
            <label htmlFor="project-name" className="mb-2 block text-sm text-muted">{t("Nome", "Name")}</label>
            <input
              id="project-name" required maxLength={120}
              value={draft.name} disabled={isSaving} className={fieldStyle}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="project-description" className="mb-2 block text-sm text-muted">{t("Descrição", "Description")}</label>
            <textarea
              id="project-description" rows={3} maxLength={2000}
              value={draft.description} disabled={isSaving} className={fieldStyle}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={isSaving} className={primaryButton}>
              {isSaving ? t("A guardar…", "Saving…") : editingId ? t("Guardar alterações", "Save changes") : t("Criar projeto", "Create project")}
            </button>
            <button
              type="button" disabled={isSaving} className={actionButton}
              onClick={() => {
                onClearFeedback();
                setDraft(null);
              }}
            >
              {t("Cancelar", "Cancel")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button" className={primaryButton} disabled={isSaving || inviteProjectId !== null}
          onClick={() => openForm({ name: "", description: "" })}
        >
          <Plus size={18} aria-hidden="true" />
          {t("Novo projeto", "New project")}
        </button>
      )}

      {projects.length === 0 && (
        <p className="rounded-xl border border-line bg-panel p-5 text-sm text-muted">
          {t("Ainda não tens projetos.", "You don't have any projects yet.")}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => (
          <article key={project.id} className="min-w-0 space-y-4 rounded-xl border border-line bg-panel p-5">
            <h3 className="flex items-center gap-2 break-all text-lg font-semibold">
              <FolderKanban size={18} aria-hidden="true" className="shrink-0 text-accent" />
              {project.name}
            </h3>
            <p className="text-sm text-accent">{project.role === "host" ? t("Anfitrião", "Host") : t("Membro", "Member")}</p>
            {project.description && <p className="whitespace-pre-wrap break-words text-sm text-muted">{project.description}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={actionButton} disabled={isSaving || draft !== null || inviteProjectId !== null} onClick={() => onViewTasks(project.id)}>
                {t("Ver tarefas", "View tasks")}
              </button>
              {project.role === "host" && <>
              <button
                type="button" className={actionButton} disabled={isSaving || draft !== null || inviteProjectId !== null}
                aria-label={t(`Editar projeto ${project.name}`, `Edit project ${project.name}`)} onClick={() => openForm(project)}
              >
                <Pencil size={15} aria-hidden="true" />
                {t("Editar", "Edit")}
              </button>
              <button
                type="button" className={actionButton} disabled={isSaving || draft !== null || inviteProjectId !== null}
                aria-label={t(`Eliminar projeto ${project.name}`, `Delete project ${project.name}`)} onClick={() => onDelete(project)}
              >
                <Trash2 size={15} aria-hidden="true" />
                {t("Eliminar", "Delete")}
              </button>
              <button
                type="button" className={actionButton} disabled={isSaving || draft !== null || inviteProjectId !== null}
                onClick={() => {
                  onClearFeedback();
                  setInviteEmail("");
                  setInviteProjectId(project.id);
                }}
              >
                {t("Convidar", "Invite")}
              </button>
              <button
                type="button" className={actionButton} disabled={isSaving || draft !== null}
                aria-expanded={peopleProjectId === project.id}
                onClick={() => setPeopleProjectId((previous) => previous === project.id ? null : project.id)}
              >
                {t("Gerir membros", "Manage members")}
              </button>
              </>}
            </div>
            {inviteProjectId === project.id && (
              <form
                className="space-y-3 border-t border-line pt-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (await onInvite(project.id, inviteEmail.trim())) setInviteProjectId(null);
                }}
              >
                <label htmlFor="project-invite-email" className="block text-sm text-muted">{t("Email da pessoa a convidar", "Invitee's email")}</label>
                <input
                  id="project-invite-email" type="email" required disabled={isSaving}
                  value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={fieldStyle}
                />
                <p className="text-sm text-muted">{t("O convite aparece na aplicação quando a pessoa entra com esse email.", "The invitation appears in the app when they sign in with this email.")}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={isSaving} className={primaryButton}>{t("Enviar convite", "Send invitation")}</button>
                  <button type="button" disabled={isSaving} className={actionButton} onClick={() => setInviteProjectId(null)}>{t("Cancelar", "Cancel")}</button>
                </div>
              </form>
            )}
            {project.role === "host" && peopleProjectId === project.id && (
              <ProjectPeople key={project.id} projectId={project.id} />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
