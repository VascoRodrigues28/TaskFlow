"use client";

import { createContext, useContext } from "react";
import type { Language } from "./auth-api";
import type { TaskPriority } from "./tasks-api";

export const LanguageContext = createContext<Language>("pt");

const portuguese = (pt: string) => pt;
const english = (_pt: string, en: string) => en;

export function useLanguage() {
  const language = useContext(LanguageContext);
  const t: (pt: string, en: string) => string = language === "en" ? english : portuguese;
  return { language, t };
}

const translatedErrors: Record<string, string> = {
  "A palavra-passe atual está incorreta.": "The current password is incorrect.",
  "O email já está registado.": "This email is already registered.",
  "Email ou palavra-passe inválidos.": "Invalid email or password.",
  "Token de acesso inválido ou expirado.": "The access token is invalid or expired.",
  "Inicia sessão para continuar.": "Sign in to continue.",
  "Não foi possível contactar a API.": "Could not reach the API.",
  "Tarefa não encontrada.": "Task not found.",
  "Projeto não encontrado.": "Project not found.",
  "Convite não encontrado.": "Invitation not found.",
  "Notificação não encontrada.": "Notification not found.",
  "Já és o anfitrião deste projeto.": "You are already the host of this project.",
  "Já existe um convite para este email.": "There is already an invitation for this email.",
  "Indica um email diferente ou uma nova palavra-passe.": "Enter a different email or a new password.",
  "Ocorreu um erro inesperado.": "An unexpected error occurred.",
  "Origem do pedido inválida.": "Invalid request origin.",
  "A API devolveu uma resposta inválida.": "The API returned an invalid response.",
  "Rota não encontrada.": "Route not found.",
  "A sessão expirou. Inicia sessão novamente.": "Your session expired. Sign in again.",
  "Credenciais atualizadas. Inicia sessão novamente.": "Credentials updated. Sign in again.",
};

export function localizeError(message: string, language: Language) {
  if (language === "pt") return message;
  const status = /^A API devolveu o erro (\d+)\.$/.exec(message);
  return status ? `The API returned error ${status[1]}.` : translatedErrors[message] ?? message;
}

export function priorityLabel(priority: TaskPriority, language: Language) {
  return language === "pt" ? priority : { Alta: "High", Média: "Medium", Baixa: "Low" }[priority];
}
