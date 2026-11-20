"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ChevronRight, Languages, Palette, ShieldCheck, UserRound } from "lucide-react";
import { ApiError, errorMessage } from "@/lib/api";
import { changeCredentials, saveProfile, type Language, type Profile, type Theme, type User } from "@/lib/auth-api";
import { localizeError, useLanguage } from "@/lib/language";

const card = "space-y-5 rounded-2xl border border-line bg-panel p-5 sm:p-8";
const field = "mt-2 block w-full rounded-lg border border-line bg-field px-3 py-2 text-foreground focus:border-emerald-500 focus:outline-none disabled:opacity-50";
const button = "rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50";

const entries = [
  {
    id: "profile", pt: "Perfil", en: "Profile", icon: UserRound,
    detail: ["Nome a apresentar e biografia", "Display name and bio"],
  },
  {
    id: "preferences", pt: "Preferências", en: "Preferences", icon: Palette,
    detail: ["Aspeto da aplicação", "App appearance"],
  },
  {
    id: "language", pt: "Idioma", en: "Language", icon: Languages,
    detail: ["Idioma da interface", "Interface language"],
  },
  {
    id: "credentials", pt: "Email e palavra-passe", en: "Email and password", icon: ShieldCheck,
    detail: ["Credenciais de acesso à conta", "Account sign-in credentials"],
  },
] as const;

type Entry = (typeof entries)[number];
const themeNames = {
  dark: ["Escuro", "Dark"],
  light: ["Claro", "Light"],
  system: ["Sistema", "System"],
} as const;

function EntryIcon({ entry }: { entry: Entry }) {
  const Icon = entry.icon;
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-accent sm:size-12">
      <Icon size={22} aria-hidden="true" />
    </span>
  );
}

function EntryHeading({ entry }: { entry: Entry }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-4 border-b border-line pb-5">
      <EntryIcon entry={entry} />
      <div>
        <h3 className="text-xl font-semibold">{t(entry.pt, entry.en)}</h3>
        <p className="mt-1 text-sm text-muted">{t(entry.detail[0], entry.detail[1])}</p>
      </div>
    </div>
  );
}

function profileFromUser({ display_name, bio, theme, language }: User): Profile {
  return { display_name, bio, theme, language };
}

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
  const [entry, setEntry] = useState<Entry | null>(null);
  const [profile, setProfile] = useState(() => profileFromUser(user));
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);

  function setPreference<K extends keyof Profile>(key: K, value: Profile[K]) {
    setSaved(false);
    setProfile((previous) => ({ ...previous, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>, operation: () => Promise<void>) {
    event.preventDefault();
    if (pending) return;
    setFormError("");
    setPending(true);
    onBusy(true);
    try {
      await operation();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized();
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setPending(false);
      onBusy(false);
    }
  }

  const changedEmail = email.trim().toLowerCase() !== user.email;

  function backToList() {
    setEntry(null);
    setProfile(profileFromUser(user));
    setEmail(user.email);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFormError("");
    setSaved(false);
  }

  if (!entry) {
    const summary: Record<Entry["id"], string> = {
      profile: user.display_name || t("Sem nome definido", "No display name set"),
      preferences: t(themeNames[user.theme][0], themeNames[user.theme][1]),
      language: user.language === "pt" ? "Português" : "English",
      credentials: user.email,
    };

    return (
      <ul className="max-w-5xl space-y-3">
        {entries.map((item) => (
          <li key={item.id}>
            <button
              type="button" onClick={() => setEntry(item)}
              aria-label={t(item.pt, item.en)}
              aria-describedby={`settings-summary-${item.id}`}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-emerald-500/40 hover:bg-tint focus-visible:outline-2 focus-visible:outline-emerald-500 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,auto)_auto] sm:gap-x-5 sm:px-6 sm:py-5"
            >
              <span className="row-span-2 sm:row-span-1"><EntryIcon entry={item} /></span>
              <span className="min-w-0">
                <span className="block font-semibold">{t(item.pt, item.en)}</span>
                <span className="mt-1 block text-sm text-muted">{t(item.detail[0], item.detail[1])}</span>
              </span>
              <span
                id={`settings-summary-${item.id}`}
                className="col-start-2 row-start-2 min-w-0 break-all text-sm text-accent sm:col-start-3 sm:row-start-1 sm:max-w-64 sm:text-right"
              >
                {summary[item.id]}
              </span>
              <ChevronRight size={18} aria-hidden="true" className="col-start-3 row-span-2 row-start-1 text-subtle sm:col-start-4 sm:row-span-1" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="max-w-5xl space-y-4">
      <button type="button" onClick={backToList} disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-accent hover:bg-tint disabled:opacity-50">
        <ArrowLeft size={17} aria-hidden="true" />
        {t("Voltar às definições", "Back to settings")}
      </button>
      {entry.id !== "credentials" ? (
      <form className={card} onSubmit={(event) => submit(event, async () => {
        const updated = await saveProfile(profile);
        setProfile(profileFromUser(updated));
        onProfile(updated);
        setSaved(true);
      })}>
        <EntryHeading entry={entry} />
        {saved && <p role="status" className="text-sm text-accent">{t("Alterações guardadas.", "Changes saved.")}</p>}
        {formError && <p role="alert" className="text-sm text-danger">{localizeError(formError, language)}</p>}
        {entry.id === "profile" && <>
        <div>
          <label htmlFor="settings-display-name" className="block text-sm text-muted">{t("Nome a apresentar", "Display name")}</label>
          <input id="settings-display-name" value={profile.display_name} autoComplete="name" maxLength={100}
            onChange={(event) => setPreference("display_name", event.target.value)} className={field} disabled={pending} />
        </div>
        <div>
          <label htmlFor="settings-bio" className="block text-sm text-muted">{t("Sobre ti", "About you")}</label>
          <textarea id="settings-bio" value={profile.bio} maxLength={500} rows={3}
            onChange={(event) => setPreference("bio", event.target.value)} className={field} disabled={pending} />
        </div>
        </>}
        {entry.id === "preferences" && (
          <div>
            <label htmlFor="settings-theme" className="block text-sm text-muted">{t("Tema", "Theme")}</label>
            <select id="settings-theme" value={profile.theme} onChange={(event) => setPreference("theme", event.target.value as Theme)} className={field} disabled={pending}>
              {(["dark", "light", "system"] as const).map((value) => (
                <option key={value} value={value}>{t(themeNames[value][0], themeNames[value][1])}</option>
              ))}
            </select>
          </div>
        )}
        {entry.id === "language" && (
          <div>
            <label htmlFor="settings-language" className="block text-sm text-muted">{t("Idioma", "Language")}</label>
            <select id="settings-language" value={profile.language} onChange={(event) => setPreference("language", event.target.value as Language)} className={field} disabled={pending}>
              <option value="pt">Português</option>
              <option value="en">English</option>
            </select>
          </div>
        )}
        <button type="submit" className={button} disabled={pending}>
          {pending ? t("A guardar…", "Saving…") : t("Guardar alterações", "Save changes")}
        </button>
      </form>
      ) : (
      <form className={card} onSubmit={(event) => submit(event, async () => {
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
        <EntryHeading entry={entry} />
        <p className="text-sm text-muted">{t("Depois de alterares as credenciais, volta a iniciar sessão.", "After changing your credentials, sign in again.")}</p>
        {formError && <p role="alert" className="text-sm text-danger">{localizeError(formError, language)}</p>}
        <div>
          <label htmlFor="settings-email" className="block text-sm text-muted">Email</label>
          <input id="settings-email" value={email} type="email" required autoComplete="username" className={field} disabled={pending}
            onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label htmlFor="settings-current-password" className="block text-sm text-muted">{t("Palavra-passe atual", "Current password")}</label>
          <input id="settings-current-password" value={currentPassword} type="password" required maxLength={128} autoComplete="current-password"
            className={field} disabled={pending} onChange={(event) => setCurrentPassword(event.target.value)} />
        </div>
        <div>
          <label htmlFor="settings-new-password" className="block text-sm text-muted">{t("Nova palavra-passe (opcional)", "New password (optional)")}</label>
          <input id="settings-new-password" value={newPassword} type="password" minLength={12} maxLength={128} autoComplete="new-password"
            className={field} disabled={pending} onChange={(event) => setNewPassword(event.target.value)} />
        </div>
        <div>
          <label htmlFor="settings-confirm-password" className="block text-sm text-muted">{t("Confirmar nova palavra-passe", "Confirm new password")}</label>
          <input id="settings-confirm-password" value={confirmPassword} type="password" required={newPassword !== ""} maxLength={128} autoComplete="new-password"
            className={field} disabled={pending} onChange={(event) => setConfirmPassword(event.target.value)} />
        </div>
        <button type="submit" className={button} disabled={pending || (!changedEmail && !newPassword)}>
          {pending ? t("A guardar…", "Saving…") : t("Alterar credenciais", "Change credentials")}
        </button>
      </form>
      )}
    </div>
  );
}
