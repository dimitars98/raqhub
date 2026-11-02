"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Trophy } from "lucide-react";
import { CancelActionButton, EditButton } from "@/components/ui/ActionButton";
import { useRouter } from "@/i18n/navigation";
import { saveSocialScore } from "@/app/actions/americano";
import { byePoints, standings, type SocialMatch, type SocialView } from "@/lib/americano";

/**
 * An evening's table and rounds. The latest round comes first, with a card
 * per court; `canScore` says which games the viewer may enter a score for.
 */
export default function SocialBoard({
  view,
  canScore,
  manager = false,
  readOnlyHint,
}: {
  view: SocialView;
  canScore: (m: SocialMatch) => boolean;
  manager?: boolean;
  readOnlyHint?: string;
}) {
  const t = useTranslations("americano");
  const rounds = [...new Set(view.matches.map((m) => m.round))].sort((a, b) => b - a);
  const [shown, setShown] = useState<number | null>(null);
  const round = shown ?? rounds[0];
  const name = new Map(view.players.map((p) => [p.id, p.name]));
  const mine = new Set(view.players.filter((p) => p.mine).map((p) => p.id));
  const table = standings(view);
  const games = view.matches.filter((m) => m.round === round);
  const out = view.byes.filter((b) => b.round === round).map((b) => b.player);
  const finished = view.event.status === "finished";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Rounds */}
      <section>
        {rounds.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-400">
            {t("noRounds")}
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink-900">{t("roundTitle", { n: round })}</h2>
              {rounds.length > 1 && (
                <div role="group" aria-label={t("rounds")} className="flex flex-wrap gap-1.5">
                  {[...rounds].reverse().map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={r === round}
                      onClick={() => setShown(r)}
                      className={`h-8 min-w-8 rounded-full border px-3 text-xs font-medium ${
                        r === round ? "border-brand-900 bg-brand-900 text-white" : "border-ink-200 bg-white text-ink-600"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {games.map((m) => (
                <GameCard
                  key={m.id}
                  match={m}
                  court={view.courts[m.court_index]?.name ?? t("court", { n: m.court_index + 1 })}
                  name={(id) => name.get(id) ?? "—"}
                  mine={mine}
                  points={view.event.points_per_match}
                  editable={canScore(m)}
                  manager={manager}
                  readOnlyHint={readOnlyHint}
                />
              ))}
            </div>
            {out.length > 0 && (
              <p className="mt-3 rounded-xl bg-ink-50 px-4 py-2.5 text-[13px] text-ink-600">
                {t("sittingOut", { names: out.map((id) => name.get(id)).join(", "), points: byePoints(view.event.points_per_match) })}
              </p>
            )}
          </>
        )}
      </section>

      {/* Table */}
      <section className="h-fit overflow-hidden rounded-2xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h2 className="text-sm font-bold text-ink-900">{finished ? t("finalTable") : t("table")}</h2>
          <span className="text-xs text-ink-400">{t("pointsEach", { n: view.event.points_per_match })}</span>
        </div>
        <table className="w-full text-sm">
          <caption className="sr-only">{t("table")}</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-ink-400">
              <th scope="col" className="w-10 py-2 pl-4 text-left font-medium">#</th>
              <th scope="col" className="py-2 text-left font-medium">{t("player")}</th>
              <th scope="col" className="w-10 py-2 text-center font-medium" title={t("playedLong")}>{t("played")}</th>
              <th scope="col" className="w-10 py-2 text-center font-medium" title={t("wonLong")}>{t("won")}</th>
              <th scope="col" className="w-14 py-2 pr-4 text-right font-medium">{t("points")}</th>
            </tr>
          </thead>
          <tbody>
            {table.map((s) => {
              const p = view.players.find((x) => x.id === s.player);
              return (
                <tr key={s.player} className={`border-t border-ink-50 ${mine.has(s.player) ? "bg-brand-50" : ""}`}>
                  <td className="py-2 pl-4 tabular-nums text-ink-400">
                    {finished && s.rank === 1 ? <Trophy size={14} className="text-[#e0a400]" aria-label="1" /> : s.rank}
                  </td>
                  <td className="py-2 pr-2">
                    <span className={`font-medium ${p?.status === "withdrawn" ? "text-ink-400 line-through" : "text-ink-900"}`}>
                      {p?.name}
                    </span>
                    {p?.mine && <span className="ml-1.5 text-xs text-brand-700">{t("you")}</span>}
                  </td>
                  <td className="py-2 text-center tabular-nums text-ink-600">{s.played}</td>
                  <td className="py-2 text-center tabular-nums text-ink-600">{s.won}</td>
                  <td className="py-2 pr-4 text-right font-bold tabular-nums text-ink-900">{s.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function GameCard({
  match: m,
  court,
  name,
  mine,
  points,
  editable,
  manager,
  readOnlyHint,
}: {
  match: SocialMatch;
  court: string;
  name: (id: string) => string;
  mine: Set<string>;
  points: number;
  editable: boolean;
  manager: boolean;
  readOnlyHint?: string;
}) {
  const t = useTranslations("americano");
  const router = useRouter();
  const scored = m.score_a != null && m.score_b != null;
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState(scored ? String(m.score_a) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = editable && (!scored || editing);
  const b = a === "" || Number.isNaN(Number(a)) ? "" : String(Math.max(0, points - Number(a)));

  const save = (value: number | null) =>
    start(async () => {
      setError(null);
      const r = await saveSocialScore(m.id, value);
      if (r.error) setError(t(`errors.${r.error}`));
      else {
        setEditing(false);
        router.refresh();
      }
    });

  const side = (ids: string[], score: number | null, won: boolean) => (
    <div className="flex items-center justify-between gap-3">
      <span className={`min-w-0 text-[14px] ${won ? "font-bold text-ink-900" : "text-ink-800"}`}>
        {ids.map((id, i) => (
          <span key={id}>
            {i > 0 && <span className="text-ink-400"> & </span>}
            <span className={mine.has(id) ? "underline decoration-brand-400 decoration-2 underline-offset-2" : ""}>{name(id)}</span>
          </span>
        ))}
      </span>
      {!open && (
        <span className={`text-xl font-extrabold tabular-nums ${won ? "text-ink-900" : "text-ink-400"}`}>{score ?? "–"}</span>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">{court}</span>
        {scored && editable && !editing && (
          <EditButton
            iconOnly
            onClick={() => setEditing(true)}
            disabled={!!readOnlyHint}
            title={readOnlyHint ?? t("editScore")}
            aria-label={t("editScore")}
          />
        )}
        {scored && !editing && <Check size={15} className="text-brand-600" aria-label={t("done")} />}
      </div>
      <div className="flex flex-col gap-2">
        {side([m.a1, m.a2], m.score_a, scored && m.score_a! > m.score_b!)}
        <div className="border-t border-dashed border-ink-100" />
        {side([m.b1, m.b2], m.score_b, scored && m.score_b! > m.score_a!)}
      </div>

      {open && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(a);
            if (a === "" || !Number.isInteger(n) || n < 0 || n > points) return setError(t("errors.score"));
            save(n);
          }}
        >
          <input
            className="input h-11 w-16 text-center text-lg tabular-nums"
            inputMode="numeric"
            aria-label={t("scoreFirst")}
            value={a}
            onChange={(e) => setA(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
          <span className="text-ink-400">–</span>
          <input
            className="input h-11 w-16 text-center text-lg tabular-nums"
            inputMode="numeric"
            aria-label={t("scoreSecond")}
            value={b}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 2);
              setA(v === "" ? "" : String(Math.max(0, points - Number(v))));
            }}
          />
          <button type="submit" disabled={pending || !!readOnlyHint} className="btn-primary h-11 disabled:opacity-50">
            {t("saveScore")}
          </button>
          {manager && scored && (
            <CancelActionButton disabled={pending} onClick={() => save(null)}>
              {t("clear")}
            </CancelActionButton>
          )}
          <span className="w-full text-xs text-ink-400">{t("scoreHint", { n: points })}</span>
          {error && (
            <p role="alert" className="w-full text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
