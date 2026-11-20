"use client";

import { useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/api";
import { submitCredentials } from "@/lib/auth-api";

export function AuthForm({ notice, onLogin }: { notice?: string; onLogin: () => void }) {
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
        setMessage("Conta criada. Inicia sessão para continuar.");
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
    "w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-emerald-500 disabled:opacity-50";

  return (
    <main className="grid min-h-screen place-items-center bg-[#09090b] p-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111113] p-6 sm:p-8">
        <p className="mb-6 text-xl font-bold">Task<span className="text-emerald-400">Flow.</span></p>
        <h1 className="mb-5 text-2xl font-bold">{isRegister ? "Criar conta" : "Iniciar sessão"}</h1>
        <form onSubmit={submit} className="space-y-4">
          {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <div>
            <label htmlFor="auth-email" className="mb-2 block text-sm text-zinc-300">Email</label>
            <input
              id="auth-email" type="email" autoComplete="username" required
              value={email} onChange={(event) => setEmail(event.target.value)}
              disabled={pending} className={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-2 block text-sm text-zinc-300">Palavra-passe</label>
            <input
              id="auth-password" type="password" autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 12 : undefined} maxLength={128} required
              aria-describedby={isRegister ? "password-hint" : undefined}
              value={password} onChange={(event) => setPassword(event.target.value)}
              disabled={pending} className={inputStyle}
            />
            {isRegister && <p id="password-hint" className="mt-2 text-sm text-zinc-400">Pelo menos 12 caracteres.</p>}
          </div>
          <button
            type="submit" disabled={pending}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {pending ? "A processar…" : isRegister ? "Criar conta" : "Entrar"}
          </button>
        </form>
        <button
          type="button" disabled={pending}
          className="mt-5 text-sm text-emerald-400 hover:underline disabled:opacity-50"
          onClick={() => {
            setMode(isRegister ? "login" : "register");
            setPassword("");
            setError("");
            setMessage("");
          }}
        >
          {isRegister ? "Já tenho conta" : "Criar uma conta"}
        </button>
      </section>
    </main>
  );
}
