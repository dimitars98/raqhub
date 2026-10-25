"use client";

import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, ShieldCheck } from "lucide-react";
import { avatarColor, initials } from "@/lib/avatar";
import { addDays } from "date-fns";
import { clubDay, clubFormat, clubTime, noon } from "@/lib/groups";
import { LEVEL_MAX, LEVEL_MIN, clampLevel, levelText, type MatchPlayer } from "@/lib/openMatches";

/** A player's round initials, the same colour every time. */
export function PlayerDot({ player, size = "size-9" }: { player: Pick<MatchPlayer, "name" | "me">; size?: string }) {
  const t = useTranslations("matches");
  return (
    <span
      title={player.name}
      className={`grid ${size} shrink-0 place-items-center rounded-full text-[11px] font-bold ${
        player.me ? "bg-brand-400 text-ink-900" : avatarColor(player.name)
      }`}
    >
      {player.me ? t("you") : initials(player.name)}
    </span>
  );
}

/** A free place in a match. */
export function EmptyDot({ size = "size-9", label }: { size?: string; label?: string }) {
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-ink-200 text-ink-400`}
    >
      <Plus size={14} aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** "3.5" with a shield when a club confirmed it. */
export function LevelTag({ level, checked }: { level: number | null; checked?: boolean }) {
  const t = useTranslations("matches");
  return (
    <span className="inline-flex items-center gap-1">
      {levelText(level)}
      {checked && (
        <ShieldCheck size={12} className="text-brand-800" aria-label={t("checkedShort")} />
      )}
    </span>
  );
}

/** "Today · 20:00–21:30", "Tomorrow · …" or "Wed 28 Oct · …", in the club's time. */
export function useWhen() {
  const t = useTranslations("matches");
  const locale = useLocale();
  return (startsAt: string, endsAt?: string) => {
    const day = clubDay(startsAt);
    const today = clubDay(new Date());
    const tomorrow = clubDay(addDays(noon(today), 1));
    const date =
      day === today
        ? t("today")
        : day === tomorrow
          ? t("tomorrow")
          : clubFormat(startsAt, locale, { weekday: "short", day: "numeric", month: "short" });
    const time = endsAt ? `${clubTime(startsAt)}–${clubTime(endsAt)}` : clubTime(startsAt);
    return `${date} · ${time}`;
  };
}

export const money = (n: number | string) => {
  const v = Number(n);
  return `€${Number.isInteger(v) ? v : v.toFixed(2)}`;
};

/** A level with − and + buttons, in steps of 0.5. */
export function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const t = useTranslations("matches");
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-600">{label}</span>
      <div className="flex items-center justify-between rounded-xl border border-ink-100 p-1">
        <button
          type="button"
          onClick={() => onChange(clampLevel(value - 0.5))}
          disabled={value <= LEVEL_MIN}
          aria-label={t("lower", { label })}
          className="grid size-10 place-items-center rounded-lg text-ink-900 hover:bg-ink-50 disabled:opacity-30"
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <span className="text-lg font-extrabold text-ink-900" aria-live="polite">
          {levelText(value)}
        </span>
        <button
          type="button"
          onClick={() => onChange(clampLevel(value + 0.5))}
          disabled={value >= LEVEL_MAX}
          aria-label={t("raise", { label })}
          className="grid size-10 place-items-center rounded-lg text-ink-900 hover:bg-ink-50 disabled:opacity-30"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
