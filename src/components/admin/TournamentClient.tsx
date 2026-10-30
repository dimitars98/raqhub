"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ArrowLeft, Check, Copy, ExternalLink, Pencil, Shuffle } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import Modal from "@/components/ui/Modal";
import Bracket from "@/components/tournaments/Bracket";
import TournamentForm from "@/components/admin/TournamentForm";
import {
  addEntry,
  deleteTournament,
  makeDraw,
  removeEntry,
  setResult,
  setSignups,
  undoDraw,
  updateTournament,
} from "@/app/[locale]/admin/tournaments/actions";
import { useCopy } from "@/hooks/useCopy";
import { entryName } from "@/lib/tournament";
import { useLabels } from "@/hooks/useLabels";
import { BADGE, TOURNAMENT_STATUS_TONE } from "@/lib/badges";
import { dateLocale } from "@/lib/dateLocale";
import type { Tournament, TournamentEntry, TournamentMatch } from "@/types/database";
import { useReadOnly } from "@/components/admin/ReadOnly";
import { DeleteButton } from "@/components/ui/ActionButton";

export default function TournamentClient({
  tournament,
  entries,
  matches,
  publicUrl,
}: {
  tournament: Tournament;
  entries: TournamentEntry[];
  matches: TournamentMatch[];
  publicUrl: string;
}) {
  const t = useTranslations("tournaments");
const { readOnly, hint } = useReadOnly();
  const labels = useLabels();
  const locale = useLocale();
  const router = useRouter();
  const { copied, copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState("");
  const [newPartner, setNewPartner] = useState("");
  const pairs = tournament.team_size === 2;
  const [editing, setEditing] = useState(false);
  const [match, setMatch] = useState<TournamentMatch | null>(null);

  const drawn = matches.length > 0;
  const full = entries.length >= tournament.max_entries;

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

  return (
    <div>
      <Link
        href="/admin/tournaments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {t("manage.back")}
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-ink-900">{tournament.name}</h1>
            <span className={`${BADGE} ${TOURNAMENT_STATUS_TONE[tournament.status]}`}>
              {t(`status.${tournament.status}`)}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-600">
            {labels.sport(tournament.sport)} ·{" "}
            {format(new Date(`${tournament.starts_on}T12:00:00`), "EEEE, d MMMM yyyy", {
              locale: dateLocale(locale),
            })}{" "}
            · {tournament.entry_fee ? t("fee", { fee: tournament.entry_fee }) : t("free")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy("link", publicUrl)} className="btn-secondary inline-flex items-center gap-2">
            {copied === "link" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied === "link" ? t("manage.copied") : t("manage.copyLink")}
          </button>
          <Link
            href={`/tournaments/${tournament.id}`}
            target="_blank"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ExternalLink size={15} aria-hidden="true" />
            {t("manage.publicPage")}
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

      {drawn ? (
        /* ---------------- The draw ---------------- */
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">{t("manage.bracket")}</h2>
              {tournament.status !== "finished" && (
                <p className="text-sm text-ink-400">{t("manage.pickWinner")}</p>
              )}
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => confirm(t("manage.redrawConfirm")) && run(() => undoDraw(tournament.id))}
              className="action action-danger"
            >
              <Shuffle size={12} aria-hidden="true" />
              {t("manage.redraw")}
            </button>
          </div>
          <Bracket matches={matches} entries={entries} onMatchClick={setMatch} />
        </section>
      ) : (
        /* ---------------- Sign-ups ---------------- */
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">{t("manage.entries")}</h2>
              <p className="text-sm text-ink-400">
                {t("entriesCount", { n: entries.length, max: tournament.max_entries })}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setSignups(tournament.id, tournament.status !== "open"))}
              className="btn-secondary"
            >
              {tournament.status === "open" ? t("manage.closeSignups") : t("manage.openSignups")}
            </button>
          </div>

          {/* Add a name (players who signed up at the desk, doubles pairs, …) */}
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => addEntry(tournament.id, newEntry, pairs ? newPartner : ""),
                () => {
                  setNewEntry("");
                  setNewPartner("");
                },
              );
            }}
          >
            <input
              className="input flex-1"
              placeholder={pairs ? t("manage.addName") : t("manage.addPlaceholder")}
              aria-label={pairs ? t("manage.addName") : t("manage.addPlaceholder")}
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              disabled={full}
            />
            {pairs && (
              <input
                className="input flex-1"
                placeholder={t("manage.addPartner")}
                aria-label={t("manage.addPartner")}
                value={newPartner}
                onChange={(e) => setNewPartner(e.target.value)}
                disabled={full}
              />
            )}
            <button type="submit" disabled={pending || full || !newEntry.trim() || (pairs && !newPartner.trim())} className="btn-primary disabled:opacity-50">
              {t("manage.addEntry")}
            </button>
          </form>

          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">{t("manage.noEntries")}</p>
          ) : (
            <ol className="divide-y divide-ink-100 rounded-xl border border-ink-100">
              {entries.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-6 tabular-nums text-ink-400">{i + 1}.</span>
                  <span className="flex-1 font-medium text-ink-900">{entryName(e)}</span>
                  {e.player_id && <span className="text-xs text-ink-400">{t("manage.signedUpOnline")}</span>}
                  <DeleteButton
                    iconOnly
                    disabled={pending}
                    onClick={() => run(() => removeEntry(tournament.id, e.id))}
                    aria-label={t("manage.remove")}
                  />
                </li>
              ))}
            </ol>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
            <p className="max-w-md text-sm text-ink-400">
              {entries.length < 2 ? t("manage.tooFewHint") : t("manage.drawHint")}
            </p>
            <button
              type="button"
              disabled={pending || entries.length < 2}
              onClick={() => run(() => makeDraw(tournament.id))}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Shuffle size={15} aria-hidden="true" />
              {t("manage.draw")}
            </button>
          </div>
        </section>
      )}

      <div className="mt-8 text-right">
        <DeleteButton
          disabled={pending}
          onClick={() =>
            confirm(t("deleteConfirm")) &&
            run(() => deleteTournament(tournament.id), () => router.push("/admin/tournaments"))
          }
        >
          {t("delete")}
        </DeleteButton>
      </div>

      {editing && (
        <TournamentForm
          initial={tournament}
          onClose={() => setEditing(false)}
          onSave={async (input) => {
            const result = await updateTournament(tournament.id, input);
            if (!result.error) router.refresh();
            return result;
          }}
        />
      )}

      {match && (
        <ResultModal
          match={match}
          entries={entries}
          pending={pending}
          onClose={() => setMatch(null)}
          onSave={(winnerId, score) =>
            run(() => setResult(tournament.id, match.id, winnerId, score), () => setMatch(null))
          }
        />
      )}
    </div>
  );
}

/** Pick the winner of a match and type the score. */
function ResultModal({
  match,
  entries,
  pending,
  onClose,
  onSave,
}: {
  match: TournamentMatch;
  entries: TournamentEntry[];
  pending: boolean;
  onClose: () => void;
  onSave: (winnerId: string | null, score: string) => void;
}) {
  const t = useTranslations("tournaments");
  const [winner, setWinner] = useState<string | null>(match.winner_id);
  const [score, setScore] = useState(match.score ?? "");
  const nameOf = (id: string | null) => {
    const e = entries.find((x) => x.id === id);
    return e ? entryName(e) : "–";
  };

  return (
    <Modal open onClose={onClose}>
      <Modal.Content>
        <Modal.Header>{t("manage.result")}</Modal.Header>
        <Modal.Body>
          <Modal.Field label={t("manage.winner")}>
            <div className="flex flex-col gap-2">
              {[match.entry1_id, match.entry2_id].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setWinner(id)}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    winner === id
                      ? "border-brand-600 bg-brand-50 text-ink-900"
                      : "border-ink-200 text-ink-600 hover:border-ink-900"
                  }`}
                >
                  {nameOf(id)}
                </button>
              ))}
            </div>
          </Modal.Field>
          <Modal.Field label={t("manage.score")}>
            <input
              className="input"
              placeholder={t("manage.scorePlaceholder")}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </Modal.Field>
        </Modal.Body>
        <Modal.Footer>
          {match.winner_id && (
            <button type="button" disabled={pending} onClick={() => onSave(null, "")} className="btn-secondary text-red-600">
              {t("manage.clearResult")}
            </button>
          )}
          <button
            type="button"
            disabled={pending || !winner}
            onClick={() => onSave(winner, score)}
            className="btn-primary flex-1 justify-center disabled:opacity-50"
          >
            {t("manage.saveResult")}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
