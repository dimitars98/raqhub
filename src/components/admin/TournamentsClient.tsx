"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Plus, Trophy } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import TournamentForm from "@/components/admin/TournamentForm";
import { createTournament } from "@/app/[locale]/admin/tournaments/actions";
import { useLabels } from "@/hooks/useLabels";
import { BADGE, TOURNAMENT_STATUS_TONE } from "@/lib/badges";
import { dateLocale } from "@/lib/dateLocale";
import type { Tournament } from "@/types/database";
import { useReadOnly } from "@/components/admin/ReadOnly";

export type TournamentRow = Tournament & { entryCount: number };

export default function TournamentsClient({ tournaments }: { tournaments: TournamentRow[] }) {
  const t = useTranslations("tournaments");
  const { readOnly, hint } = useReadOnly();
  const labels = useLabels();
  const locale = useLocale();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-400">{t("subtitle")}</p>
        </div>
        <button title={hint} disabled={readOnly} type="button" onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} aria-hidden="true" />
          {t("new")}
        </button>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white px-6 py-16 text-center">
          <Trophy size={28} className="mx-auto mb-3 text-ink-200" aria-hidden="true" />
          <p className="text-base font-semibold text-ink-900">{t("empty")}</p>
          <p className="mt-1 text-sm text-ink-400">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tour) => (
            <Link
              key={tour.id}
              href={`/admin/tournaments/${tour.id}`}
              className="rounded-2xl border border-ink-100 bg-white p-5 transition-colors hover:border-ink-900"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink-900">{tour.name}</p>
                <span className={`${BADGE} shrink-0 ${TOURNAMENT_STATUS_TONE[tour.status]}`}>
                  {t(`status.${tour.status}`)}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-600">
                {labels.sport(tour.sport)} ·{" "}
                {format(new Date(`${tour.starts_on}T12:00:00`), "d MMM yyyy", {
                  locale: dateLocale(locale),
                })}
              </p>
              <p className="mt-3 text-xs text-ink-400">
                {t("entriesCount", { n: tour.entryCount, max: tour.max_entries })}
              </p>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <TournamentForm
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            const result = await createTournament(input);
            if (result.id) router.push(`/admin/tournaments/${result.id}`);
            return result;
          }}
        />
      )}
    </div>
  );
}
