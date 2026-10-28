"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useRouter } from "@/i18n/navigation";
import { saveLeagueScore } from "@/app/actions/leagues";
import {
  entryName,
  scoreText,
  type LeagueEntry,
  type LeagueMatch,
  type LeagueRound,
  type SetScore,
} from "@/lib/leagues";

/**
 * One round of a league: a card per box with its table and matches.
 * `canScore` says which matches the viewer may enter a score for; the club
 * (`manager`) can also record a walkover or clear a score.
 */
export default function LeagueBoxes({
  round,
  entries,
  moveCount,
  canScore,
  manager = false,
  readOnlyHint,
}: {
  round: LeagueRound;
  entries: LeagueEntry[];
  moveCount: number;
  canScore: (m: LeagueMatch) => boolean;
  manager?: boolean;
  /** Set while the club is read-only: why scores can't be entered. */
  readOnlyHint?: string;
}) {
  const t = useTranslations("leagues");
  const [editing, setEditing] = useState<LeagueMatch | null>(null);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const nameOf = (id: string) => {
    const e = byId.get(id);
    return e ? entryName(e) : "—";
  };
  const lastBox = round.boxes.length;
  const playing = round.status === "playing";

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {round.boxes.map((box) => {
          const size = box.standings.length;
          const played = box.matches.filter((m) => m.winner_id).length;
          return (
            <section key={box.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
                <h3 className="text-sm font-bold text-ink-900">{t("box", { n: box.number })}</h3>
                <span className="text-xs text-ink-400">
                  {t("matchesPlayed", { n: played, total: box.matches.length })}
                </span>
              </div>

              {/* Table */}
              <table className="w-full text-sm">
                <caption className="sr-only">{t("box", { n: box.number })}</caption>
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-ink-400">
                    <th scope="col" className="w-12 py-2 pl-4 text-left font-medium">#</th>
                    <th scope="col" className="py-2 text-left font-medium">{t("table.name")}</th>
                    <th scope="col" className="w-9 py-2 text-center font-medium" title={t("table.playedLong")}>{t("table.played")}</th>
                    <th scope="col" className="w-9 py-2 text-center font-medium" title={t("table.wonLong")}>{t("table.won")}</th>
                    <th scope="col" className="hidden w-12 py-2 text-center font-medium sm:table-cell" title={t("table.setsLong")}>{t("table.sets")}</th>
                    <th scope="col" className="w-12 py-2 pr-4 text-right font-medium" title={t("table.pointsLong")}>{t("table.points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {box.standings.map((s) => {
                    const e = byId.get(s.entry_id);
                    // Who would move if the round ended now (once there are scores).
                    const up = played > 0 && moveCount > 0 && box.number > 1 && s.rank <= moveCount;
                    const down = played > 0 && moveCount > 0 && box.number < lastBox && s.rank > size - moveCount;
                    return (
                      <tr key={s.entry_id} className={`border-t border-ink-50 ${e?.mine ? "bg-brand-50" : ""}`}>
                        <td className="py-2 pl-4 tabular-nums text-ink-400">
                          <span className="inline-flex items-center gap-0.5">
                            {s.rank}
                            {up && <ArrowUp size={12} className="text-brand-600" aria-label={t("movesUp")} />}
                            {down && <ArrowDown size={12} className="text-red-500" aria-label={t("movesDown")} />}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`font-medium ${e?.status === "withdrawn" ? "text-ink-400 line-through" : "text-ink-900"}`}>
                            {nameOf(s.entry_id)}
                          </span>
                          {e?.mine && <span className="ml-1.5 text-xs text-brand-700">{t("you")}</span>}
                        </td>
                        <td className="py-2 text-center tabular-nums text-ink-600">{s.played}</td>
                        <td className="py-2 text-center tabular-nums text-ink-600">{s.won}</td>
                        <td className="hidden py-2 text-center tabular-nums text-ink-600 sm:table-cell">
                          {s.sets_won}–{s.sets_lost}
                        </td>
                        <td className="py-2 pr-4 text-right font-bold tabular-nums text-ink-900">{s.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Matches */}
              <ul className="divide-y divide-ink-50 border-t border-ink-100 bg-ink-50/40">
                {box.matches.map((m) => {
                  const editable = canScore(m);
                  const w1 = m.winner_id === m.entry1_id;
                  const w2 = m.winner_id === m.entry2_id;
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                      <span className="min-w-0 flex-1">
                        <span className={w1 ? "font-semibold text-ink-900" : "text-ink-600"}>{nameOf(m.entry1_id)}</span>
                        <span className="px-1.5 text-ink-400">{t("vs")}</span>
                        <span className={w2 ? "font-semibold text-ink-900" : "text-ink-600"}>{nameOf(m.entry2_id)}</span>
                      </span>
                      {m.winner_id ? (
                        <span className="shrink-0 tabular-nums font-medium text-ink-900">
                          {m.walkover ? t("walkover") : scoreText(m.sets)}
                        </span>
                      ) : (
                        !editable && <span className="shrink-0 text-xs text-ink-400">{t("toPlay")}</span>
                      )}
                      {editable && (
                        <button
                          type="button"
                          disabled={!!readOnlyHint}
                          title={readOnlyHint}
                          onClick={() => setEditing(m)}
                          className={
                            m.winner_id
                              ? "grid size-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-white hover:text-ink-900 disabled:opacity-50"
                              : "shrink-0 rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
                          }
                          aria-label={m.winner_id ? t("editScore") : undefined}
                        >
                          {m.winner_id ? <Pencil size={14} aria-hidden="true" /> : t("enterScore")}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {editing && (
        <ScoreModal
          match={editing}
          name1={nameOf(editing.entry1_id)}
          name2={nameOf(editing.entry2_id)}
          manager={manager}
          roundPlaying={playing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ScoreModal({
  match,
  name1,
  name2,
  manager,
  roundPlaying,
  onClose,
}: {
  match: LeagueMatch;
  name1: string;
  name2: string;
  manager: boolean;
  roundPlaying: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("leagues");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Three sets of two boxes; the third is only for a deciding set.
  const start = match.sets ?? [];
  const [games, setGames] = useState<string[][]>(
    [0, 1, 2].map((i) => (start[i] ? [String(start[i][0]), String(start[i][1])] : ["", ""])),
  );

  const run = (sets: SetScore[] | null, walkover: string | null) => {
    setError(null);
    startTransition(async () => {
      const r = await saveLeagueScore(match.id, sets, walkover);
      if (r.error) setError(t(`errors.${r.error}`));
      else {
        onClose();
        router.refresh();
      }
    });
  };

  const save = () => {
    const sets: SetScore[] = [];
    for (const [a, b] of games) {
      if (a === "" && b === "") continue;
      const x = Number(a);
      const y = Number(b);
      if (a === "" || b === "" || !Number.isInteger(x) || !Number.isInteger(y) || x === y) {
        return setError(t("errors.score"));
      }
      sets.push([x, y]);
    }
    const won1 = sets.filter(([a, b]) => a > b).length;
    if (!sets.length || won1 * 2 === sets.length) return setError(t("errors.score"));
    run(sets, null);
  };

  const cell = "input h-11 w-14 text-center text-base tabular-nums";

  return (
    <Modal open onClose={onClose}>
      <Modal.Content className="max-w-md">
        <Modal.Header>{t("score.title")}</Modal.Header>
        <Modal.Body>
          {error && (
            <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
          <p className="text-sm text-ink-600">{t("score.hint")}</p>
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] items-center gap-x-2 gap-y-2">
            <span />
            {[1, 2, 3].map((n) => (
              <span key={n} className="text-center text-[11px] font-medium uppercase tracking-wider text-ink-400">
                {t("score.set", { n })}
              </span>
            ))}
            {[name1, name2].map((name, side) => (
              <div key={side} className="contents">
                <span className="truncate text-sm font-semibold text-ink-900">{name}</span>
                {[0, 1, 2].map((i) => (
                  <input
                    key={i}
                    className={cell}
                    inputMode="numeric"
                    maxLength={2}
                    aria-label={`${name}, ${t("score.set", { n: i + 1 })}`}
                    value={games[i][side]}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      setGames((g) => g.map((s, j) => (j === i ? (side === 0 ? [v, s[1]] : [s[0], v]) : s)));
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-400">{t("score.thirdSetHint")}</p>

          {manager && (
            <div className="mt-2 rounded-xl bg-ink-50 p-3">
              <p className="mb-2 text-xs font-medium text-ink-600">{t("score.walkoverTitle")}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  [match.entry1_id, name1],
                  [match.entry2_id, name2],
                ].map(([id, name]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={pending}
                    onClick={() => run(null, id)}
                    className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 hover:border-ink-900"
                  >
                    {t("score.didntPlay", { name })}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!manager && !roundPlaying && <p className="text-xs text-ink-400">{t("errors.roundDone")}</p>}
        </Modal.Body>
        <Modal.Footer>
          {manager && match.winner_id ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(null, null)}
              className="btn-secondary flex-1 text-red-600"
            >
              {t("score.clear")}
            </button>
          ) : (
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              {t("cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {pending ? t("saving") : t("score.save")}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
