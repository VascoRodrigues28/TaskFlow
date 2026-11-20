"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ApiError, errorMessage } from "@/lib/api";
import { getActivity, type ContributionCalendar } from "@/lib/activity-api";
import { localizeError, useLanguage } from "@/lib/language";

const dayMs = 86_400_000;
const colors = [
  "border-line bg-tint",
  "border-emerald-500/30 bg-emerald-500/25",
  "border-emerald-500/40 bg-emerald-500/50",
  "border-emerald-600/60 bg-emerald-500/75",
  "border-emerald-700 bg-emerald-600",
];

function level(count: number) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count < 4) return 2;
  return count < 7 ? 3 : 4;
}

const calendarCard = "rounded-2xl border border-line bg-panel p-4 sm:p-6";

export function ActivityCalendar({ onUnauthorized }: { onUnauthorized: () => void }) {
  const { t, language } = useLanguage();
  const [calendar, setCalendar] = useState<ContributionCalendar | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<{ index: number; left: number; top: number; above: boolean } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const tooltipVisible = hovered !== null;

  useEffect(() => {
    const controller = new AbortController();
    getActivity(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setCalendar(result);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) onUnauthorized();
        else setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [attempt, onUnauthorized]);

  useEffect(() => {
    if (calendar && viewport.current) viewport.current.scrollLeft = viewport.current.scrollWidth;
  }, [calendar]);

  useEffect(() => {
    if (!tooltipVisible) return;
    const hide = () => setHovered(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [tooltipVisible]);

  if (!calendar) {
    return (
      <section className={calendarCard} aria-labelledby="activity-heading">
        <h3 id="activity-heading" className="text-xl font-semibold">{t("A tua atividade", "Your activity")}</h3>
        {error ? (
          <div className="mt-3 space-y-2 text-sm">
            <p role="alert" className="text-danger">{localizeError(error, language)}</p>
            <button type="button" className="text-accent underline" onClick={() => {
              setError("");
              setAttempt((previous) => previous + 1);
            }}>{t("Tentar novamente", "Try again")}</button>
          </div>
        ) : <p role="status" className="mt-3 text-sm text-muted">{t("A carregar atividade…", "Loading activity…")}</p>}
      </section>
    );
  }

  const start = Date.parse(calendar.start);
  const end = Date.parse(calendar.end);
  const days = Array.from({ length: (end - start) / dayMs + 1 }, (_, index) => {
    const date = new Date(start + index * dayMs);
    const key = date.toISOString().slice(0, 10);
    return { date, key, count: calendar.days[key] ?? 0 };
  });
  const offset = (days[0].date.getUTCDay() + 6) % 7;
  const weekCount = Math.ceil((days.length + offset) / 7);
  const firstMonthBoundary = days.findIndex((day) => day.date.getUTCDate() === 1);
  const selectedIndex = selected ?? days.length - 1;
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const locale = language === "pt" ? "pt-PT" : "en-GB";
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" });
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const gridStyle = { gridTemplateColumns: `repeat(${weekCount}, minmax(12px, 1fr))` };

  function contributionCount(count: number) {
    return count === 1 ? t("1 contribuição", "1 contribution")
      : t(`${count} contribuições`, `${count} contributions`);
  }

  function dayLabel(day: (typeof days)[number]) {
    return `${fullDate.format(day.date)} · ${contributionCount(day.count)}`;
  }

  function showDayTooltip(button: HTMLButtonElement, index: number) {
    const bounds = button.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const tooltipWidth = Math.min(224, viewportWidth - 16);
    const left = Math.max(8, Math.min(
      bounds.left + (bounds.width - tooltipWidth) / 2,
      viewportWidth - tooltipWidth - 8,
    ));
    const above = bounds.top >= 64;
    setHovered({ index, left, top: above ? bounds.top - 8 : bounds.bottom + 8, above });
  }

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target = {
      ArrowLeft: index - 7, ArrowRight: index + 7, ArrowUp: index - 1, ArrowDown: index + 1,
      Home: 0, End: days.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(target, days.length - 1));
    setSelected(next);
    viewport.current?.querySelector<HTMLButtonElement>(`[data-activity-index="${next}"]`)?.focus();
  }

  return (
    <section className={calendarCard} aria-labelledby="activity-heading">
      <h3 id="activity-heading" className="text-xl font-semibold">{t("A tua atividade", "Your activity")}</h3>
      <p className="mt-1 text-sm text-muted">
        <strong className="text-foreground">{contributionCount(total)}</strong> {t("nos últimos 12 meses", "in the last 12 months")}
      </p>
      <div ref={viewport} className="mt-5 overflow-x-auto pb-3">
        <div className="min-w-[860px] px-1">
          <div aria-hidden="true" className="mb-2 grid h-5 gap-1 text-xs text-muted" style={gridStyle}>
            {days.map(({ date, key }, index) => (date.getUTCDate() === 1
              || (index === 0 && firstMonthBoundary + offset >= 14)) && (
              <span key={key} className="whitespace-nowrap" style={{ gridColumn: Math.floor((index + offset) / 7) + 1, gridRow: 1 }}>
                {monthFormat.format(date)}
              </span>
            ))}
          </div>
          <div role="group" aria-label={t("Contribuições por dia", "Contributions by day")}
            className="grid grid-rows-7 gap-1" style={gridStyle}>
            {days.map((day, index) => (
              <button
                key={day.key} type="button" data-activity-index={index}
                aria-label={dayLabel(day)} tabIndex={index === selectedIndex ? 0 : -1}
                aria-pressed={index === selectedIndex} onClick={() => setSelected(index)}
                onKeyDown={(event) => moveFocus(event, index)}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "touch") showDayTooltip(event.currentTarget, index);
                }}
                onPointerLeave={() => setHovered(null)}
                className={`aspect-square min-w-0 rounded-[3px] border ${colors[level(day.count)]} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500 ${index === selectedIndex ? "ring-1 ring-inset ring-emerald-500" : ""}`}
                style={{ gridColumn: Math.floor((index + offset) / 7) + 1, gridRow: (index + offset) % 7 + 1 }}
              />
            ))}
          </div>
        </div>
      </div>
      {hovered && (
        <div
          aria-hidden="true" data-activity-tooltip
          className="pointer-events-none fixed z-40 w-56 max-w-[calc(100vw-16px)] rounded-lg border border-line-strong bg-dialog px-3 py-2 text-xs shadow-lg"
          style={{ left: hovered.left, top: hovered.top, transform: hovered.above ? "translateY(-100%)" : undefined }}
        >
          <p className="font-semibold text-foreground">{fullDate.format(days[hovered.index].date)}</p>
          <p className="mt-0.5 text-accent">{contributionCount(days[hovered.index].count)}</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-between gap-3 text-xs text-muted">
        <p aria-live="polite">{dayLabel(days[selectedIndex])}</p>
        <div aria-hidden="true" className="flex items-center gap-1.5">
          {t("Menos", "Less")}
          {colors.map((color) => <span key={color} className={`size-3 rounded-[2px] border ${color}`} />)}
          {t("Mais", "More")}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">{t(
        "Conta projetos criados e tarefas criadas, atribuídas ou concluídas por ti.",
        "Counts projects you create and tasks you create, assign or complete.",
      )}</p>
    </section>
  );
}
