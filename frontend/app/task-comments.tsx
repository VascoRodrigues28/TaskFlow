"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageSquare } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { localizeError, useLanguage } from "@/lib/language";
import { startLiveRefresh } from "@/lib/live-refresh";
import { createTaskComment, listTaskComments, type TaskComment } from "@/lib/tasks-api";

export function TaskComments({ taskId }: { taskId: number }) {
  const { t, language } = useLanguage();
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const dateFormat = new Intl.DateTimeFormat(language === "pt" ? "pt-PT" : "en-GB", {
    dateStyle: "medium", timeStyle: "short",
  });

  useEffect(() => {
    if (pending) return;
    return startLiveRefresh(async (signal) => {
      try {
        const items = await listTaskComments(taskId, signal);
        if (signal.aborted || submitting.current) return;
        setComments(items);
        setLoadError("");
      } catch (error) {
        if (!signal.aborted && !submitting.current) setLoadError(errorMessage(error));
      }
    });
  }, [taskId, pending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !body.trim()) return;
    submitting.current = true;
    setPending(true);
    setSubmitError("");
    try {
      const saved = await createTaskComment(taskId, body.trim());
      setComments((previous) => [...(previous ?? []), saved]);
      setBody("");
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-line pt-4" aria-labelledby="task-comments-title">
      <h3 id="task-comments-title" className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare size={16} aria-hidden="true" className="text-accent" />
        {t("Comentários", "Comments")}
      </h3>
      {loadError && <p role="alert" className="text-sm text-danger">{localizeError(loadError, language)}</p>}
      {!comments && !loadError && <p role="status" className="text-sm text-muted">{t("A carregar comentários…", "Loading comments…")}</p>}
      {comments?.length === 0 && <p className="text-sm text-muted">{t("Ainda não há comentários.", "No comments yet.")}</p>}
      {!!comments?.length && (
        <ol className="divide-y divide-line rounded-lg border border-line bg-field">
          {comments.map((comment) => (
            <li key={comment.id} className="space-y-1.5 px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <strong className="min-w-0 break-words text-sm">{comment.author_name}</strong>
                <time dateTime={comment.created_at} className="text-xs text-muted">
                  {dateFormat.format(new Date(comment.created_at))}
                </time>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{comment.body}</p>
            </li>
          ))}
        </ol>
      )}
      <form className="space-y-2" onSubmit={submit}>
        <label htmlFor="task-comment-body" className="block text-sm font-medium">{t("Novo comentário", "New comment")}</label>
        <textarea
          id="task-comment-body" rows={3} required maxLength={2000} value={body} disabled={pending}
          onChange={(event) => setBody(event.target.value)}
          className="block w-full resize-y rounded-lg border border-line bg-field px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        />
        {submitError && <p role="alert" className="text-sm text-danger">{localizeError(submitError, language)}</p>}
        <button type="submit" disabled={pending || !body.trim()}
          className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50">
          {pending ? t("A publicar…", "Posting…") : t("Publicar comentário", "Post comment")}
        </button>
      </form>
    </section>
  );
}
