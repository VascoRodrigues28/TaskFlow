"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api";
import { localizeError, useLanguage } from "@/lib/language";
import { startLiveRefresh } from "@/lib/live-refresh";
import { getProjectPeople, removeProjectAccess, type ProjectPeople as People } from "@/lib/projects-api";

export function ProjectPeople({ projectId }: { projectId: string }) {
  const { t, language } = useLanguage();
  const [people, setPeople] = useState<People | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const updating = useRef(false);

  useEffect(() => {
    if (pending) return;
    return startLiveRefresh(async (signal) => {
      try {
        const result = await getProjectPeople(projectId, signal);
        if (signal.aborted || updating.current) return;
        setPeople(result);
        setLoadError("");
      } catch (error) {
        if (!signal.aborted && !updating.current) setLoadError(errorMessage(error));
      }
    });
  }, [pending, projectId]);

  async function remove(kind: "members" | "invitations", id: string, name: string) {
    if (updating.current) return;
    const confirmation = kind === "members"
      ? t(`Remover «${name}» do projeto?`, `Remove “${name}” from the project?`)
      : t(`Cancelar o convite para ${name}?`, `Cancel the invitation to ${name}?`);
    if (!window.confirm(confirmation)) return;
    updating.current = true;
    setPending(true);
    setMessage("");
    setActionError("");
    try {
      await removeProjectAccess(projectId, kind, id);
      setPeople((previous) => previous && {
        ...previous,
        [kind]: previous[kind].filter((entry) => entry.id !== id),
      });
      setMessage(kind === "members" ? t("Membro removido.", "Member removed.") : t("Convite cancelado.", "Invitation cancelled."));
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      updating.current = false;
      setPending(false);
    }
  }

  const actionStyle = "shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs text-danger hover:bg-red-500/10 disabled:opacity-50";
  return (
    <section className="space-y-4 border-t border-line pt-4" aria-label={t("Gerir membros", "Manage members")}>
      {(loadError || actionError) && <p role="alert" className="text-sm text-danger">{localizeError(actionError || loadError, language)}</p>}
      {message && <p role="status" className="text-sm text-accent">{message}</p>}
      {!people && !loadError && <p role="status" className="text-sm text-muted">{t("A carregar membros…", "Loading members…")}</p>}
      {people && (
        <>
          <div>
            <h4 className="mb-2 text-sm font-semibold">{t("Membros", "Members")}</h4>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {people.members.map((member) => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0 break-all">
                    <p>{member.name}</p>
                    {member.email !== member.name && <p className="text-xs text-muted">{member.email}</p>}
                  </div>
                  {member.role === "host" ? (
                    <span className="text-xs font-medium text-accent">{t("Anfitrião", "Host")}</span>
                  ) : (
                    <button type="button" disabled={pending} className={actionStyle}
                      aria-label={t(`Remover ${member.name}`, `Remove ${member.name}`)}
                      onClick={() => remove("members", member.id, member.name)}
                    >{t("Remover", "Remove")}</button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">{t("Convites pendentes", "Pending invitations")}</h4>
            {people.invitations.length === 0 ? (
              <p className="text-sm text-muted">{t("Sem convites pendentes.", "No pending invitations.")}</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {people.invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <span className="min-w-0 break-all">{invitation.email}</span>
                    <button type="button" disabled={pending} className={actionStyle}
                      aria-label={t(`Cancelar convite para ${invitation.email}`, `Cancel invitation to ${invitation.email}`)}
                      onClick={() => remove("invitations", invitation.id, invitation.email)}
                    >{t("Cancelar convite", "Cancel invitation")}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
