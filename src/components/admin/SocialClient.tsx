"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ArrowLeft, Check, Copy, ExternalLink, Flag, Pencil, Play, RotateCcw, Undo2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import SocialForm, { type ClubCourt } from "@/components/americano/SocialForm";
import SocialBoard from "@/components/americano/SocialBoard";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import {
  addSocialPlayer,
  deleteSocial,
  finishSocial,
  nextSocialRound,
  removeSocialPlayer,
  undoSocialRound,
  updateSocial,
} from "@/app/[locale]/admin/americano/actions";
import { useCopy } from "@/hooks/useCopy";
import { useLabels } from "@/hooks/useLabels";
import { BADGE } from "@/lib/badges";
import { dateLocale } from "@/lib/dateLocale";
import { LEVELS } from "@/lib/leagues";
import { roundShape, suggestedRounds, type SocialView } from "@/lib/americano";
import { useReadOnly } from "@/components/admin/ReadOnly";
import { DeleteButton } from "@/components/ui/ActionButton";
import SelectField from "@/components/ui/SelectField";

export default function SocialClient({
  view,
  courts,
  publicUrl,
  heldError,
}: {
  view: SocialView;
  courts: ClubCourt[];
  publicUrl: string;
  heldError: string | null;
}) {
  const t = useTranslations("americano");
  const { readOnly, hint } = useReadOnly();
  const labels = useLabels();
  const df = dateLocale(useLocale());
  const router = useRouter();
  const { copied, copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(heldError ? t(`errors.${heldError}`) : null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState({ name: "", level: "" });

  const { event } = view;
  const started = event.status !== "open";
  const active = view.players.filter((p) => p.status === "active");
  const lastRound = Math.max(0, ...view.matches.map((m) => m.round));
  const current = view.matches.filter((m) => m.round === lastRound);
  const scored = current.filter((m) => m.score_a != null).length;
  const shape = roundShape(active.length, view.courts.length);

  const run = (action: () => Promise<{ error?: string }>, after?: () => void) => {
    setError(null);
    if (readOnly) return setError(hint ?? null);
    startTransition(async () => {
      const r = await action();
      if (r.error) setError(t(`errors.${r.error}`));
      else {
        after?.();
        router.refresh();
      }
    });
  };

  const when = `${format(new Date(event.starts_at), "EEEE d MMMM, HH:mm", { locale: df })}–${format(new Date(event.ends_at), "HH:mm")}`;
  const dark = "inline-flex h-10 items-center gap-1.5 rounded-full border border-white/25 px-4 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50";

  return (
    <div>
      <Link href="/admin/americano" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900">
        <ArrowLeft size={14} aria-hidden="true" />
        {t("back")}
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-ink-900">{event.name}</h1>
            <span className={`${BADGE} ${LEAGUE_STATUS_TONE[event.status]}`}>{t(`status.${event.status}`)}</span>
          </div>
          <p className="mt-1 text-sm text-ink-600">
            {t(`formats.${event.format}`)} · {labels.sport(event.sport)} · {when}
          </p>
          <p className="mt-0.5 text-sm text-ink-400">
            {view.courts.map((c) => c.name).join(", ") || t("form.noCourts")} · {t("pointsEach", { n: event.points_per_match })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy("link", publicUrl)} className="btn-secondary inline-flex items-center gap-2">
            {copied === "link" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied === "link" ? t("copied") : t("copyLink")}
          </button>
          <Link href={`/americano/${event.id}`} target="_blank" className="btn-secondary inline-flex items-center gap-2">
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
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#111c0a] p-5 text-white">
        <div className="min-w-0">
          {event.status === "finished" ? (
            <p className="text-base font-semibold">{t("finishedTitle")}</p>
          ) : lastRound ? (
            <>
              <p className="text-base font-semibold">{t("roundLive", { n: lastRound })}</p>
              <p className="mt-0.5 text-sm text-white/70">
                {t("roundProgress", { n: scored, total: current.length })} ·{" "}
                {t("suggested", { n: suggestedRounds(active.length) })}
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold">{t("readyTitle")}</p>
              <p className="mt-0.5 max-w-xl text-sm text-white/70">
                {active.length < 4
                  ? t("tooFewHint")
                  : t("readyHint", { players: active.length, games: shape.games, byes: shape.byes })}
              </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {event.status === "finished" ? (
            <button type="button" disabled={pending || readOnly} onClick={() => run(() => finishSocial(event.id, false))} className={dark}>
              <RotateCcw size={15} aria-hidden="true" />
              {t("reopen")}
            </button>
          ) : (
            <>
              {lastRound > 0 && scored === 0 && (
                <button
                  type="button"
                  disabled={pending || readOnly}
                  onClick={() => confirm(t("undoConfirm", { n: lastRound })) && run(() => undoSocialRound(event.id))}
                  className={dark}
                >
                  <Undo2 size={15} aria-hidden="true" />
                  {t("undoRound")}
                </button>
              )}
              {lastRound > 0 && (
                <button
                  type="button"
                  disabled={pending || readOnly}
                  onClick={() => confirm(t("finishConfirm")) && run(() => finishSocial(event.id))}
                  className={dark}
                >
                  <Flag size={15} aria-hidden="true" />
                  {t("finish")}
                </button>
              )}
              <button
                type="button"
                title={hint}
                disabled={pending || readOnly || active.length < 4 || view.courts.length === 0}
                onClick={() =>
                  (lastRound === 0 ||
                    scored === current.length ||
                    confirm(t("nextConfirmUnplayed", { left: current.length - scored }))) &&
                  run(() => nextSocialRound(event.id))
                }
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#a8d832] px-4 text-sm font-semibold text-[#111c0a] hover:bg-[#bfe655] disabled:opacity-50"
              >
                <Play size={15} aria-hidden="true" />
                {lastRound ? t("nextRound", { n: lastRound + 1 }) : t("start")}
              </button>
            </>
          )}
        </div>
      </section>

      {/* Rounds and table */}
      {view.matches.length > 0 && (
        <div className="mb-8">
          <SocialBoard view={view} canScore={() => event.status !== "finished"} manager readOnlyHint={readOnly ? hint : undefined} />
        </div>
      )}

      {/* Players */}
      <section className="rounded-2xl border border-ink-100 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-ink-900">{t("players")}</h2>
          <p className="text-sm text-ink-400">
            {t("playersCount", { n: active.length, max: event.max_players })}
            {started && <> · {t("addLaterHint")}</>}
          </p>
        </div>

        {event.status !== "finished" && (
          <form
            className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => addSocialPlayer(event.id, adding.name, adding.level === "" ? null : Number(adding.level)),
                () => setAdding({ name: "", level: "" }),
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
            <SelectField
              ariaLabel={t("level")}
              value={adding.level}
              onChange={(v) => setAdding((a) => ({ ...a, level: v }))}
              options={[{ value: "", label: t("level") }, ...LEVELS.map((l) => ({ value: String(l), label: l.toFixed(1) }))]}
            />
            <button type="submit" disabled={pending || readOnly || !adding.name.trim()} className="btn-primary justify-center disabled:opacity-50">
              {t("add")}
            </button>
          </form>
        )}

        {view.players.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">{t("noPlayers")}</p>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {[...active, ...view.players.filter((p) => p.status === "withdrawn")].map((p, i) => {
              const out = p.status === "withdrawn";
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2 text-sm">
                  <span className="w-6 tabular-nums text-ink-400">{out ? "–" : `${i + 1}.`}</span>
                  <span className={`min-w-0 flex-1 truncate font-medium ${out ? "text-ink-400 line-through" : "text-ink-900"}`}>{p.name}</span>
                  {p.level != null && (
                    <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-600">
                      {Number(p.level).toFixed(1)}
                    </span>
                  )}
                  {!out && event.status !== "finished" && (
                    <DeleteButton
                      iconOnly
                      disabled={pending || readOnly}
                      onClick={() =>
                        (!started || confirm(t("withdrawConfirm", { name: p.name }))) && run(() => removeSocialPlayer(p.id, started))
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
          onClick={() => confirm(t("deleteConfirm")) && run(() => deleteSocial(event.id), () => router.push("/admin/americano"))}
          className="mt-6"
        >
          {t("delete")}
        </DeleteButton>
      </section>

      {editing && (
        <SocialForm initial={event} courts={courts} onClose={() => setEditing(false)} onSave={(input) => updateSocial(event.id, input)} />
      )}
    </div>
  );
}
