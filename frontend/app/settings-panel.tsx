"use client";

import { useState, type FormEvent } from "react";
import { ApiError, errorMessage } from "@/lib/api";
import { changeCredentials, saveProfile, type Language, type Profile, type Theme, type User } from "@/lib/auth-api";
import { localizeError, useLanguage } from "@/lib/language";

const card = "space-y-4 rounded-xl border border-line bg-panel p-5 sm:p-6";
const field = "mt-2 block w-full rounded-lg border border-line bg-field px-3 py-2 text-foreground focus:border-emerald-500 focus:outline-none disabled:opacity-50";
const button = "rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50";

export function SettingsPanel({
  user, onProfile, onCredentialsChanged, onUnauthorized, onBusy,
}: {
  user: User;
  onProfile: (user: User) => void;
  onCredentialsChanged: () => void;
  onUnauthorized: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const [profile, setProfile] = useState<Profile>({
    display_name: user.display_name, bio: user.bio, theme: user.theme, language: user.language,
  });
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState<"profile" | "credentials" | null>(null);
  const [formError, setFormError] = useState<{ form: "profile" | "credentials"; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  function setPreference<K extends keyof Profile>(key: K, value: Profile[K]) {
    setSaved(false);
    setProfile((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(
    event: FormEvent<HTMLFormElement>, form: "profile" | "credentials", operation: () => Promise<void>,
  ) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);
    setPending(form);
    onBusy(true);
    try {
      await operation();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
      } else {
        setFormError({ form, message: errorMessage(error) });
      }
    } finally {
      setPending(null);
      onBusy(false);
    }
  }

  const changedEmail = email.trim().toLowerCase() !== user.email;

  return (
    <div className="grid max-w-5xl items-start gap-5 xl:grid-cols-2">
      <form className={card} onSubmit={(event) => submit(event, "profile", async () => {
        const updated = await saveProfile(profile);
        setProfile({
          display_name: updated.display_name, bio: updated.bio, theme: updated.theme, language: updated.language,
        });
        onProfile(updated);
        setSaved(true);
      })}>
        <h3 className="text-lg font-semibold">{t("Perfil e preferências", "Profile and preferences")}</h3>
        {saved && <p role="status" className="text-sm text-accent">{t("Preferências guardadas.", "Preferences saved.")}</p>}
        {formError?.form === "profile" && <p role="alert" className="text-sm text-danger">{localizeError(formError.message, language)}</p>}
        <div>
          <label htmlFor="settings-display-name" className="block text-sm text-muted">{t("Nome a apresentar", "Display name")}</label>
          <input id="settings-display-name" value={profile.display_name} autoComplete="name" maxLength={100}
            onChange={(event) => setPreference("display_name", event.target.value)} className={field} disabled={pending !== null} />
        </div>
        <div>
          <label htmlFor="settings-bio" className="block text-sm text-muted">{t("Sobre ti", "About you")}</label>
          <textarea id="settings-bio" value={profile.bio} maxLength={500} rows={3}
            onChange={(event) => setPreference("bio", event.target.value)} className={field} disabled={pending !== null} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-theme" className="block text-sm text-muted">{t("Tema", "Theme")}</label>
            <select id="settings-theme" value={profile.theme} onChange={(event) => setPreference("theme", event.target.value as Theme)} className={field} disabled={pending !== null}>
              <option value="dark">{t("Escuro", "Dark")}</option>
              <option value="light">{t("Claro", "Light")}</option>
              <option value="system">{t("Sistema", "System")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="settings-language" className="block text-sm text-muted">{t("Idioma", "Language")}</label>
            <select id="settings-language" value={profile.language} onChange={(event) => setPreference("language", event.target.value as Language)} className={field} disabled={pending !== null}>
              <option value="pt">Português</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <button type="submit" className={button} disabled={pending !== null}>
          {pending === "profile" ? t("A guardar…", "Saving…") : t("Guardar preferências", "Save preferences")}
        </button>
      </form>

      <form className={card} onSubmit={(event) => submit(event, "credentials", async () => {
        if (newPassword !== confirmPassword) {
          throw new Error(t("As palavras-passe novas não coincidem.", "The new passwords do not match."));
        }
        await changeCredentials({
          current_password: currentPassword,
          email: changedEmail ? email.trim() : undefined,
          new_password: newPassword || undefined,
        });
        onCredentialsChanged();
      })}>
        <h3 className="text-lg font-semibold">{t("Email e palavra-passe", "Email and password")}</h3>
        <p className="text-sm text-muted">{t("Depois de alterares as credenciais, volta a iniciar sessão.", "After changing your credentials, sign in again.")}</p>
        {formError?.form === "credentials" && <p role="alert" className="text-sm text-danger">{localizeError(formError.message, language)}</p>}
        <div>
          <label htmlFor="settings-email" className="block text-sm text-muted">Email</label>
          <input id="settings-email" value={email} type="email" required autoComplete="username" className={field} disabled={pending !== null}
            onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label htmlFor="settings-current-password" className="block text-sm text-muted">{t("Palavra-passe atual", "Current password")}</label>
          <input id="settings-current-password" value={currentPassword} type="password" required maxLength={128} autoComplete="current-password"
            className={field} disabled={pending !== null} onChange={(event) => setCurrentPassword(event.target.value)} />
        </div>
        <div>
          <label htmlFor="settings-new-password" className="block text-sm text-muted">{t("Nova palavra-passe (opcional)", "New password (optional)")}</label>
          <input id="settings-new-password" value={newPassword} type="password" minLength={12} maxLength={128} autoComplete="new-password"
            className={field} disabled={pending !== null} onChange={(event) => setNewPassword(event.target.value)} />
        </div>
        <div>
          <label htmlFor="settings-confirm-password" className="block text-sm text-muted">{t("Confirmar nova palavra-passe", "Confirm new password")}</label>
          <input id="settings-confirm-password" value={confirmPassword} type="password" required={newPassword !== ""} maxLength={128} autoComplete="new-password"
            className={field} disabled={pending !== null} onChange={(event) => setConfirmPassword(event.target.value)} />
        </div>
        <button type="submit" className={button} disabled={pending !== null || (!changedEmail && !newPassword)}>
          {pending === "credentials" ? t("A guardar…", "Saving…") : t("Alterar credenciais", "Change credentials")}
        </button>
      </form>
    </div>
  );
}
