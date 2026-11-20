"use client";

import { useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/api";
import { submitCredentials } from "@/lib/auth-api";
import { localizeError, useLanguage } from "@/lib/language";

export function AuthForm({ notice, onLogin }: { notice?: string; onLogin: () => void }) {
  const { t, language } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(notice ?? "");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setMessage("");
    setPending(true);

    try {
      await submitCredentials(mode, email.trim(), password);
      if (isRegister) {
        setMode("login");
        setPassword("");
        setMessage(t("Conta criada. Inicia sessão para continuar.", "Account created. Sign in to continue."));
      } else {
        onLogin();
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const inputStyle =
    "w-full rounded-lg border border-line bg-field px-4 py-3 text-foreground outline-none focus:border-emerald-500 disabled:opacity-50";

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 sm:p-8">
        <p className="mb-6 text-xl font-bold">Task<span className="text-accent">Flow.</span></p>
        <h1 className="mb-5 text-2xl font-bold">{isRegister ? t("Criar conta", "Create an account") : t("Iniciar sessão", "Sign in")}</h1>
        <form onSubmit={submit} className="space-y-4">
          {message && <p role="status" className="text-sm text-accent">{message}</p>}
          {error && <p role="alert" className="text-sm text-danger">{localizeError(error, language)}</p>}
          <div>
            <label htmlFor="auth-email" className="mb-2 block text-sm text-muted">Email</label>
            <input
              id="auth-email" type="email" autoComplete="username" required
              value={email} onChange={(event) => setEmail(event.target.value)}
              disabled={pending} className={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-2 block text-sm text-muted">{t("Palavra-passe", "Password")}</label>
            <input
              id="auth-password" type="password" autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 12 : undefined} maxLength={128} required
              aria-describedby={isRegister ? "password-hint" : undefined}
              value={password} onChange={(event) => setPassword(event.target.value)}
              disabled={pending} className={inputStyle}
            />
            {isRegister && <p id="password-hint" className="mt-2 text-sm text-muted">{t("Pelo menos 12 caracteres.", "At least 12 characters.")}</p>}
          </div>
          <button
            type="submit" disabled={pending}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? t("A processar…", "Working…") : isRegister ? t("Criar conta", "Create account") : t("Entrar", "Sign in")}
          </button>
        </form>
        <button
          type="button" disabled={pending}
          className="mt-5 text-sm text-accent hover:underline disabled:opacity-50"
          onClick={() => {
            setMode(isRegister ? "login" : "register");
            setPassword("");
            setError("");
            setMessage("");
          }}
        >
          {isRegister ? t("Já tenho conta", "I already have an account") : t("Criar uma conta", "Create an account")}
        </button>
      </section>
    </main>
  );
}
