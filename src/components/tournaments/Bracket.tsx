"use client";

import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import { entryName, roundName } from "@/lib/tournament";
import type { TournamentEntry, TournamentMatch } from "@/types/database";

/**
 * The knockout draw, one column per round. On the club's screen each match
 * can be tapped to enter its result (onMatchClick); on the public page it is
 * read-only.
 */
export default function Bracket({
  matches,
  entries,
  onMatchClick,
}: {
  matches: TournamentMatch[];
  entries: Pick<TournamentEntry, "id" | "name">[];
  onMatchClick?: (match: TournamentMatch) => void;
}) {
  const t = useTranslations("tournaments");
  const nameOf = new Map(entries.map((e) => [e.id, entryName(e)]));
  const rounds = Math.max(0, ...matches.map((m) => m.round));
  const columns = Array.from({ length: rounds }, (_, i) =>
    matches.filter((m) => m.round === i + 1).sort((a, b) => a.position - b.position),
  );
  const final = columns[rounds - 1]?.[0];
  const champion = final?.winner_id ? nameOf.get(final.winner_id) : null;

  // A first-round match with only one player is a bye.
  const isBye = (m: TournamentMatch) => m.round === 1 && (!m.entry1_id || !m.entry2_id);
  const label = (m: TournamentMatch, id: string | null) =>
    id ? (nameOf.get(id) ?? "–") : isBye(m) ? t("bye") : t("tbd");

  return (
    <div>
      {champion && (
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-900">
          <Trophy size={16} aria-hidden="true" />
          {t("manage.champion", { name: champion })}
        </p>
      )}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-6">
          {columns.map((column, i) => {
            const { key, n } = roundName(i + 1, rounds);
            return (
              <div key={i} className="flex w-56 flex-col">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {t(`rounds.${key}`, { n: n ?? 0 })}
                </p>
                {/* justify-around keeps each match between the two it comes from */}
                <div className="flex flex-1 flex-col justify-around gap-3">
                  {column.map((m) => {
                    const clickable = !!onMatchClick && !!m.entry1_id && !!m.entry2_id;
                    const card = (
                      <>
                        <Side id={m.entry1_id} match={m} label={label(m, m.entry1_id)} />
                        <div className="h-px bg-ink-100" />
                        <Side id={m.entry2_id} match={m} label={label(m, m.entry2_id)} />
                        {m.score && (
                          <div className="border-t border-ink-100 px-3 py-1.5 text-xs text-ink-400">
                            {m.score}
                          </div>
                        )}
                      </>
                    );
                    return clickable ? (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onMatchClick(m)}
                        className="w-full overflow-hidden rounded-xl border border-ink-100 bg-white text-left transition-colors hover:border-ink-900"
                      >
                        {card}
                      </button>
                    ) : (
                      <div
                        key={m.id}
                        className={`overflow-hidden rounded-xl border border-ink-100 ${
                          isBye(m) ? "bg-ink-50" : "bg-white"
                        }`}
                      >
                        {card}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** One player's line in a match: bold with a dot for the winner, grey for the loser. */
function Side({ id, match, label }: { id: string | null; match: TournamentMatch; label: string }) {
  const won = !!id && match.winner_id === id;
  const lost = !!match.winner_id && !!id && match.winner_id !== id;
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${
        won ? "font-semibold text-ink-900" : lost ? "text-ink-400" : "text-ink-600"
      }`}
    >
      <span className="truncate">{label}</span>
      {won && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-brand-600" />}
    </div>
  );
}
