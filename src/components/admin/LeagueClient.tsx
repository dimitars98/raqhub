"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, ExternalLink, Flag, Pencil, Play, Undo2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import LeagueForm from "@/components/leagues/LeagueForm";
import LeagueBoxes from "@/components/leagues/LeagueBoxes";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import {
  addLeagueEntry,
  deleteLeague,
  finishLeague,
  nextRound,
  removeLeagueEntry,
  saveSeeding,
  undoRound,
  updateLeague,
} from "@/app/[locale]/admin/leagues/actions";
import { useCopy } from "@/hooks/useCopy";
import { useLabels } from "@/hooks/useLabels";
import { BADGE } from "@/lib/badges";
import { dateLocale } from "@/lib/dateLocale";
import { entryName, LEVELS, type LeagueView } from "@/lib/leagues";
import { useReadOnly } from "@/components/admin/ReadOnly";
import { DeleteButton } from "@/components/ui/ActionButton";
import SelectField from "@/components/ui/SelectField";

export default function LeagueClient({ view, publicUrl }: { view: LeagueView; publicUrl: string }) {
  const t = useTranslations("leagues");
  const { readOnly, hint } = useReadOnly();
  const labels = useLabels();
  const locale = useLocale();
  const df = dateLocale(locale);
  const router = useRouter();
  const { copied, copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState({ name: "", partner: "", level: "" });
  const [roundNo, setRoundNo] = useState<number | null>(null);

  const { league, entries, rounds } = view;
  const pairs = league.team_size === 2;
  const started = league.status !== "open";
  const current = rounds.find((r) => r.status === "playing") ?? null;
  const shown = rounds.find((r) => r.number === roundNo) ?? current ?? rounds[0] ?? null;
  const active = entries.filter((e) => e.status === "active");
  const scored = current ? current.boxes.flatMap((b) => b.matches).filter((m) => m.winner_id).length : 0;
  const total = current ? current.boxes.flatMap((b) => b.matches).length : 0;
  const day = (d: string, f = "d MMM") => format(new Date(`${d}T12:00:00`), f, { locale: df });

  // Runs a server action, shows its error, and reloads the data.
  const run = (action: () => Promise<{ error?: string }>, after?: () => void) => {
    setError(null);
    if (readOnly) return setError(hint ?? null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(t(`errors.${result.error}`));
      else {
        after?.();
        router.refresh();
      }
    });
  };

  const move = (i: number, by: -1 | 1) => {
    const order = active.map((e) => e.id);
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    run(() => saveSeeding(league.id, order));
  };
  const sortByLevel = () =>
    run(() =>
      saveSeeding(
        league.id,
        [...active].sort((a, b) => (b.level ?? -1) - (a.level ?? -1)).map((e) => e.id),
      ),
    );

  return (
    <div>
      <Link href="/admin/leagues" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900">
        <ArrowLeft size={14} aria-hidden="true" />
        {t("back")}
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-ink-900">{league.name}</h1>
            <span className={`${BADGE} ${LEAGUE_STATUS_TONE[league.status]}`}>{t(`status.${league.status}`)}</span>
          </div>
          <p className="mt-1 text-sm text-ink-600">
            {labels.sport(league.sport)} · {pairs ? t("form.pairs") : t("form.singles")} ·{" "}
            {t("summary", { weeks: league.round_weeks, size: league.box_size })} · {t("startsOn", { date: day(league.starts_on, "d MMMM yyyy") })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy("link", publicUrl)} className="btn-secondary inline-flex items-center gap-2">
            {copied === "link" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied === "link" ? t("copied") : t("copyLink")}
          </button>
          <Link href={`/leagues/${league.id}`} target="_blank" className="btn-secondary inline-flex items-center gap-2">
            <ExternalLink size={15} aria-hidden="true" />
            {t("publicPage")}
          </Link>
          <button title={hint} disabled={readOnly} type="button" onClick={() => setEditing(true)} className="btn-secondary inline-flex items-center gap-2">
            <Pencil size={15} aria-hidden="true" />
            {t("edit")}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* What to do next */}
      {league.status !== "finished" && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#111c0a] p-5 text-white">
          <div className="min-w-0">
            {current ? (
              <>
                <p className="text-base font-semibold">
                  {t("roundLive", { n: current.number, date: day(current.ends_on, "EEEE d MMMM") })}
                </p>
                <p className="mt-0.5 text-sm text-white/70">{t("roundProgress", { n: scored, total })}</p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">{t("readyTitle")}</p>
                <p className="mt-0.5 max-w-xl text-sm text-white/70">
                  {active.length < 2 ? t("tooFewHint") : t("readyHint", { n: active.length, size: league.box_size })}
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {current && scored === 0 && (
              <button
                type="button"
                disabled={pending || readOnly}
                onClick={() => confirm(t("undoConfirm", { n: current.number })) && run(() => undoRound(league.id))}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/25 px-4 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
              >
                <Undo2 size={15} aria-hidden="true" />
                {t("undoRound")}
              </button>
            )}
            {current && (
              <button
                type="button"
                disabled={pending || readOnly}
                onClick={() => confirm(t("finishConfirm")) && run(() => finishLeague(league.id))}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/25 px-4 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
              >
                <Flag size={15} aria-hidden="true" />
                {t("finish")}
              </button>
            )}
            <button
              type="button"
              title={hint}
              disabled={pending || readOnly || active.length < 2}
              onClick={() =>
                (!current || confirm(t(scored < total ? "nextConfirmUnplayed" : "nextConfirm", { n: current.number, left: total - scored }))) &&
                run(() => nextRound(league.id), () => setRoundNo(null))
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#a8d832] px-4 text-sm font-semibold text-[#111c0a] hover:bg-[#bfe655] disabled:opacity-50"
            >
              <Play size={15} aria-hidden="true" />
              {current ? t("nextRound", { n: current.number + 1 }) : t("startRound1")}
            </button>
          </div>
        </section>
      )}

      {/* Rounds */}
      {shown && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-900">
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
                    onClick={() => setRoundNo(r.number)}
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
          <LeagueBoxes
            round={shown}
            entries={entries}
            moveCount={league.move_count}
            canScore={() => true}
            manager
            readOnlyHint={readOnly ? hint : undefined}
          />
        </section>
      )}

      {/* Players */}
      <section className="rounded-2xl border border-ink-100 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{pairs ? t("pairs") : t("players")}</h2>
            <p className="text-sm text-ink-400">
              {t(pairs ? "pairsCount" : "playersCount", { n: active.length, max: league.max_entries })}
              {!started && active.length > 1 && <> · {t("seedHint")}</>}
              {started && <> · {t("addLaterHint")}</>}
            </p>
          </div>
          {!started && active.length > 1 && (
            <button type="button" disabled={pending || readOnly} onClick={sortByLevel} className="btn-secondary">
              {t("sortByLevel")}
            </button>
          )}
        </div>

        {league.status !== "finished" && (
          <form
            className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  addLeagueEntry(league.id, adding.name, adding.partner, adding.level === "" ? null : Number(adding.level)),
                () => setAdding({ name: "", partner: "", level: "" }),
              );
            }}
          >
            <input
              className="input"
              placeholder={t("addName")}
              aria-label={t("addName")}
              value={adding.name}
              onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))}
            />
            {pairs ? (
              <input
                className="input"
                placeholder={t("addPartner")}
                aria-label={t("addPartner")}
                value={adding.partner}
                onChange={(e) => setAdding((a) => ({ ...a, partner: e.target.value }))}
              />
            ) : (
              <span className="hidden sm:block" />
            )}
            <SelectField
              ariaLabel={t("level")}
              value={adding.level}
              onChange={(v) => setAdding((a) => ({ ...a, level: v }))}
              options={[{ value: "", label: t("level") }, ...LEVELS.map((l) => ({ value: String(l), label: l.toFixed(1) }))]}
            />
            <button
              type="submit"
              disabled={pending || readOnly || !adding.name.trim() || (pairs && !adding.partner.trim())}
              className="btn-primary justify-center disabled:opacity-50"
            >
              {t("add")}
            </button>
          </form>
        )}

        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">{t("noEntries")}</p>
        ) : (
          <ol className="divide-y divide-ink-100 rounded-xl border border-ink-100">
            {[...active, ...entries.filter((e) => e.status === "withdrawn")].map((e) => {
              const i = active.indexOf(e);
              const out = e.status === "withdrawn";
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-6 tabular-nums text-ink-400">{out ? "–" : `${i + 1}.`}</span>
                  <span className={`min-w-0 flex-1 truncate font-medium ${out ? "text-ink-400 line-through" : "text-ink-900"}`}>
                    {entryName(e)}
                  </span>
                  {e.level != null && (
                    <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-600">
                      {Number(e.level).toFixed(1)}
                    </span>
                  )}
                  {out && <span className="text-xs text-ink-400">{t("withdrawn")}</span>}
                  {!started && !out && (
                    <span className="flex">
                      <button
                        type="button"
                        disabled={pending || readOnly || i === 0}
                        onClick={() => move(i, -1)}
                        aria-label={t("moveUp")}
                        className="grid size-7 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-30"
                      >
                        <ArrowUp size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={pending || readOnly || i === active.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label={t("moveDown")}
                        className="grid size-7 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-30"
                      >
                        <ArrowDown size={14} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {!out && league.status !== "finished" && (
                    <DeleteButton
                      iconOnly
                      disabled={pending || readOnly}
                      onClick={() =>
                        (!started || confirm(t("withdrawConfirm", { name: entryName(e) }))) &&
                        run(() => removeLeagueEntry(e.id, started))
                      }
                      aria-label={t("remove")}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <DeleteButton
          disabled={pending || readOnly}
          onClick={() =>
            confirm(t("deleteConfirm")) &&
            run(() => deleteLeague(league.id), () => router.push("/admin/leagues"))
          }
          className="mt-6"
        >
          {t("delete")}
        </DeleteButton>
      </section>

      {editing && (
        <LeagueForm
          initial={league}
          onClose={() => setEditing(false)}
          onSave={(input) => updateLeague(league.id, input, started)}
        />
      )}
    </div>
  );
}
