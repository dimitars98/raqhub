"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, ShieldCheck, Swords } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useLabels } from "@/hooks/useLabels";
import { addDays } from "date-fns";
import { clubDay, noon } from "@/lib/groups";
import {
  MATCH_SPORTS,
  bandOf,
  fitsLevel,
  isFull,
  levelText,
  type MatchCard as Match,
  type MyLevel,
} from "@/lib/openMatches";
import type { Sport } from "@/types/database";
import MatchCard from "./MatchCard";

type Day = "any" | "today" | "tomorrow" | "week";

export default function MatchesClient({
  matches,
  levels,
  club,
  initialSport,
}: {
  matches: Match[];
  levels: MyLevel[];
  club: { id: string; name: string; slug: string } | null;
  initialSport: Sport | null;
}) {
  const t = useTranslations("matches");
  const labels = useLabels();
  // Start on the sport the player has a level for (padel first), or all.
  const [sport, setSport] = useState<Sport | "all">(initialSport ?? "all");
  const [day, setDay] = useState<Day>("any");
  const [atMyLevel, setAtMyLevel] = useState(false);

  const levelFor = (s: Sport) => levels.find((l) => l.sport === s) ?? null;
  const level = sport === "all" ? null : levelFor(sport);

  const shown = (() => {
    const today = clubDay(new Date());
    const tomorrow = clubDay(addDays(noon(today), 1));
    const weekEnd = clubDay(addDays(noon(today), 7));
    return matches.filter((m) => {
      if (sport !== "all" && m.sport !== sport) return false;
      const d = clubDay(m.starts_at);
      if (day === "today" && d !== today) return false;
      if (day === "tomorrow" && d !== tomorrow) return false;
      if (day === "week" && d > weekEnd) return false;
      if (atMyLevel && !m.mine && !fitsLevel(m, levelFor(m.sport)?.level)) return false;
      return true;
    });
  })();

  const mine = shown.filter((m) => m.mine);
  const open = shown.filter((m) => !m.mine && !isFull(m));
  const newHref = `/matches/new${club ? `?club=${club.slug}` : ""}${
    sport !== "all" ? `${club ? "&" : "?"}sport=${sport}` : ""
  }`;

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors ${
      active ? "border-ink-900 bg-ink-900 font-semibold text-white" : "border-ink-100 bg-white text-ink-600 hover:border-ink-200"
    }`;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 pb-24 sm:pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">
            {club ? t("titleAt", { club: club.name }) : t("title")}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {t("subtitle")}
            {club && (
              <>
                {" · "}
                <Link href="/matches" className="underline hover:text-ink-900">
                  {t("allClubs")}
                </Link>
              </>
            )}
          </p>
        </div>
        <Link href={newHref} className="btn-primary hidden sm:inline-flex">
          <Plus size={16} aria-hidden="true" />
          {t("start")}
        </Link>
      </div>

      {/* Sport */}
      <div
        role="tablist"
        aria-label={t("sport")}
        className="grid grid-cols-4 gap-1 rounded-[14px] border border-ink-100 bg-white p-1"
      >
        {(["all", ...MATCH_SPORTS] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={sport === s}
            onClick={() => setSport(s)}
            className={`h-10 rounded-[10px] text-[13px] transition-colors ${
              sport === s ? "bg-ink-900 font-semibold text-white" : "text-ink-600 hover:bg-ink-50"
            }`}
          >
            {s === "all" ? t("allSports") : labels.sport(s)}
          </button>
        ))}
      </div>

      {/* Level */}
      {sport !== "all" && (
        <div className="flex items-center justify-between gap-3 rounded-[18px] bg-ink-900 px-4 py-3.5 text-white">
          {level ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold tracking-wider text-brand-200 uppercase">
                {t("yourLevel", { sport: labels.sport(sport) })}
              </span>
              <span className="text-[22px] font-extrabold">
                {levelText(level.level)}{" "}
                <span className="text-[13px] font-medium text-ink-200">· {t(`bands.${bandOf(level.level)}.name`)}</span>
              </span>
              <span className="flex items-center gap-1 text-xs text-ink-200">
                {level.confirmed_club ? (
                  <>
                    <ShieldCheck size={13} aria-hidden="true" />
                    {t("checkedBy", { club: level.confirmed_club })}
                  </>
                ) : (
                  t("selfRated")
                )}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold">{t("noLevelTitle", { sport: labels.sport(sport) })}</span>
              <span className="text-xs text-ink-200">{t("noLevelHint")}</span>
            </div>
          )}
          <Link
            href={`/matches/level?sport=${sport}`}
            className="shrink-0 rounded-full bg-brand-400 px-3.5 py-2.5 text-[13px] font-semibold text-ink-900"
          >
            {level ? t("change") : t("setLevel")}
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button type="button" aria-pressed={atMyLevel} onClick={() => setAtMyLevel((v) => !v)} className={chip(atMyLevel)}>
          {t("atMyLevel")}
        </button>
        {(["any", "today", "tomorrow", "week"] as const).map((d) => (
          <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)} className={chip(day === d)}>
            {t(`days.${d}`)}
          </button>
        ))}
      </div>

      {mine.length > 0 && (
        <section aria-labelledby="mine" className="flex flex-col gap-2.5">
          <h2 id="mine" className="text-xs font-semibold tracking-wider text-ink-600 uppercase">
            {t("yourMatches")}
          </h2>
          {mine.map((m) => (
            <MatchCard key={m.id} match={m} myLevel={levelFor(m.sport)?.level ?? null} showClub={!club} />
          ))}
        </section>
      )}

      <section aria-labelledby="open" className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 id="open" className="text-xs font-semibold tracking-wider text-ink-600 uppercase">
            {t("lookingForPlayers")}
          </h2>
          <span className="text-xs text-ink-600">{t("count", { n: open.length })}</span>
        </div>
        {open.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
            <div className="mb-4 grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-800">
              <Swords size={22} aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-ink-900">{t("empty")}</p>
            <p className="mt-1 max-w-sm text-sm text-ink-600">{t("emptyHint")}</p>
            <Link href={newHref} className="btn-primary mt-5">
              {t("start")}
            </Link>
          </div>
        ) : (
          open.map((m) => (
            <MatchCard key={m.id} match={m} myLevel={levelFor(m.sport)?.level ?? null} showClub={!club} />
          ))
        )}
      </section>

      {/* On phones the main button sits at the bottom of the screen. */}
      <div className="fixed inset-x-4 bottom-5 z-30 sm:hidden">
        <Link
          href={newHref}
          className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-brand-400 text-[15px] font-bold text-ink-900 shadow-lg"
        >
          <Plus size={18} aria-hidden="true" />
          {t("start")}
        </Link>
      </div>
    </div>
  );
}
