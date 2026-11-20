"use client";

import { useState, type FormEvent } from "react";
import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import type { Project, ProjectInput } from "@/lib/projects-api";

type Props = {
  projects: Project[];
  isSaving: boolean;
  onSave: (input: ProjectInput, id?: string) => Promise<boolean>;
  onDelete: (project: Project) => void;
  onViewTasks: (id: string) => void;
  onInvite: (id: string, email: string) => Promise<boolean>;
  onClearFeedback: () => void;
};

const fieldStyle = "w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-500 disabled:opacity-50";
const primaryButton = "inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50";
const actionButton = "inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50";

export function ProjectsPanel({ projects, isSaving, onSave, onDelete, onViewTasks, onInvite, onClearFeedback }: Props) {
  const [draft, setDraft] = useState<Project | ProjectInput | null>(null);
  const [inviteProjectId, setInviteProjectId] = useState<string | null>(null);
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
      setValidationError("Introduz um nome para o projeto.");
      return;
    }

    setValidationError("");
    if (await onSave({ name, description: draft.description.trim() }, editingId)) {
      setDraft(null);
    }
  }

  return (
    <section aria-label="Gestão de projetos" className="space-y-5">
      {draft ? (
        <form onSubmit={submit} className="max-w-xl space-y-4 rounded-xl border border-white/10 bg-[#111113] p-5">
          <h3 className="text-lg font-semibold">{editingId ? "Editar projeto" : "Novo projeto"}</h3>
          {validationError && <p role="alert" className="text-sm text-red-400">{validationError}</p>}
          <div>
            <label htmlFor="project-name" className="mb-2 block text-sm text-zinc-300">Nome</label>
            <input
              id="project-name" required maxLength={120}
              value={draft.name} disabled={isSaving} className={fieldStyle}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </div>
          <div>
            <label htmlFor="project-description" className="mb-2 block text-sm text-zinc-300">Descrição</label>
            <textarea
              id="project-description" rows={3} maxLength={2000}
              value={draft.description} disabled={isSaving} className={fieldStyle}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={isSaving} className={primaryButton}>
              {isSaving ? "A guardar…" : editingId ? "Guardar alterações" : "Criar projeto"}
            </button>
            <button
              type="button" disabled={isSaving} className={actionButton}
              onClick={() => {
                onClearFeedback();
                setDraft(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button" className={primaryButton} disabled={isSaving || inviteProjectId !== null}
          onClick={() => openForm({ name: "", description: "" })}
        >
          <Plus size={18} aria-hidden="true" />
          Novo projeto
        </button>
      )}

      {projects.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-[#111113] p-5 text-sm text-zinc-400">
          Ainda não tens projetos.
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {projects.map((project) => (
          <article key={project.id} className="min-w-0 space-y-4 rounded-xl border border-white/10 bg-[#111113] p-5">
            <h3 className="flex items-center gap-2 break-all text-lg font-semibold">
              <FolderKanban size={18} aria-hidden="true" className="shrink-0 text-emerald-400" />
              {project.name}
            </h3>
            <p className="text-sm text-emerald-400">{project.role === "host" ? "Anfitrião" : "Membro"}</p>
            {project.description && <p className="whitespace-pre-wrap break-words text-sm text-zinc-400">{project.description}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={actionButton} disabled={isSaving || draft !== null || inviteProjectId !== null} onClick={() => onViewTasks(project.id)}>
                Ver tarefas
              </button>
              {project.role === "host" && <>
              <button
                type="button" className={actionButton} disabled={isSaving || draft !== null || inviteProjectId !== null}
                aria-label={`Editar projeto ${project.name}`} onClick={() => openForm(project)}
              >
                <Pencil size={15} aria-hidden="true" />
                Editar
              </button>
              <button
                type="button" className={actionButton} disabled={isSaving || draft !== null || inviteProjectId !== null}
                aria-label={`Eliminar projeto ${project.name}`} onClick={() => onDelete(project)}
              >
                <Trash2 size={15} aria-hidden="true" />
                Eliminar
              </button>
              <button
                type="button" className={actionButton} disabled={isSaving || draft !== null || inviteProjectId !== null}
                onClick={() => {
                  onClearFeedback();
                  setInviteEmail("");
                  setInviteProjectId(project.id);
                }}
              >
                Convidar
              </button>
              </>}
            </div>
            {inviteProjectId === project.id && (
              <form
                className="space-y-3 border-t border-white/10 pt-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (await onInvite(project.id, inviteEmail.trim())) setInviteProjectId(null);
                }}
              >
                <label htmlFor="project-invite-email" className="block text-sm text-zinc-300">Email da pessoa a convidar</label>
                <input
                  id="project-invite-email" type="email" required disabled={isSaving}
                  value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className={fieldStyle}
                />
                <p className="text-sm text-zinc-400">O convite aparece na aplicação quando a pessoa entra com esse email.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={isSaving} className={primaryButton}>Enviar convite</button>
                  <button type="button" disabled={isSaving} className={actionButton} onClick={() => setInviteProjectId(null)}>Cancelar</button>
                </div>
              </form>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
