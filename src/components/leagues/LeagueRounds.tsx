"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import LeagueBoxes from "@/components/leagues/LeagueBoxes";
import { dateLocale } from "@/lib/dateLocale";
import type { LeagueEntry, LeagueMatch, LeagueRound } from "@/lib/leagues";

/**
 * A league's rounds on its public page, newest first, with tabs for the older
 * ones. A player can enter the score of their own matches in the current round.
 */
export default function LeagueRounds({
  rounds,
  entries,
  moveCount,
}: {
  rounds: LeagueRound[];
  entries: LeagueEntry[];
  moveCount: number;
}) {
  const t = useTranslations("leagues");
  const df = dateLocale(useLocale());
  const [shownId, setShownId] = useState(rounds[0]?.id);
  const shown = rounds.find((r) => r.id === shownId) ?? rounds[0];
  if (!shown) return null;

  const mine = new Set(entries.filter((e) => e.mine).map((e) => e.id));
  const canScore = (m: LeagueMatch) =>
    shown.status === "playing" &&
    (mine.has(m.entry1_id) || mine.has(m.entry2_id)) &&
    (!m.winner_id || m.reported_by_me);
  const day = (d: string) => format(new Date(`${d}T12:00:00`), "d MMM", { locale: df });

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-ink-900">
          {t("roundTitle", { n: shown.number })}{" "}
          <span className="text-sm font-normal text-ink-400">
            {day(shown.starts_on)} – {day(shown.ends_on)}
          </span>
        </h2>
        {rounds.length > 1 && (
          <div role="group" aria-label={t("rounds")} className="flex flex-wrap gap-1.5">
            {[...rounds].reverse().map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === shown.id}
                onClick={() => setShownId(r.id)}
                className={`h-8 min-w-8 rounded-full border px-3 text-xs font-medium ${
                  r.id === shown.id ? "border-brand-900 bg-brand-900 text-white" : "border-ink-200 bg-white text-ink-600"
                }`}
              >
                {r.number}
              </button>
            ))}
          </div>
        )}
      </div>
      {shown.status === "playing" && mine.size > 0 && (
        <p className="mb-3 rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-800">{t("public.yourMatchesHint")}</p>
      )}
      <LeagueBoxes round={shown} entries={entries} moveCount={moveCount} canScore={canScore} />
    </section>
  );
}
