"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Layers, Plus } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import LeagueForm from "@/components/leagues/LeagueForm";
import { createLeague } from "@/app/[locale]/admin/leagues/actions";
import { useLabels } from "@/hooks/useLabels";
import { BADGE } from "@/lib/badges";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import { dateLocale } from "@/lib/dateLocale";
import type { League } from "@/lib/leagues";
import { useReadOnly } from "@/components/admin/ReadOnly";

export type LeagueRow = League & { entryCount: number };

export default function LeaguesClient({ leagues }: { leagues: LeagueRow[] }) {
  const t = useTranslations("leagues");
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
          <p className="mt-1 max-w-xl text-sm text-ink-400">{t("subtitle")}</p>
        </div>
        <button
          title={hint}
          disabled={readOnly}
          type="button"
          onClick={() => setCreating(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} aria-hidden="true" />
          {t("new")}
        </button>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white px-6 py-14 text-center">
          <Layers size={28} className="mx-auto mb-3 text-ink-200" aria-hidden="true" />
          <p className="text-base font-semibold text-ink-900">{t("empty")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">{t("emptyHint")}</p>
          <ol className="mx-auto mt-6 grid max-w-2xl gap-3 text-left text-sm sm:grid-cols-3">
            {(["how1", "how2", "how3"] as const).map((k, i) => (
              <li key={k} className="rounded-xl bg-ink-50 p-4">
                <span className="mb-2 grid size-6 place-items-center rounded-full bg-ink-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-ink-600">{t(k)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((l) => (
            <Link
              key={l.id}
              href={`/admin/leagues/${l.id}`}
              className="rounded-2xl border border-ink-100 bg-white p-5 transition-colors hover:border-ink-900"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink-900">{l.name}</p>
                <span className={`${BADGE} shrink-0 ${LEAGUE_STATUS_TONE[l.status]}`}>{t(`status.${l.status}`)}</span>
              </div>
              <p className="mt-1 text-sm text-ink-600">
                {labels.sport(l.sport)} · {l.team_size === 2 ? t("form.pairs") : t("form.singles")} ·{" "}
                {format(new Date(`${l.starts_on}T12:00:00`), "d MMM yyyy", { locale: dateLocale(locale) })}
              </p>
              <p className="mt-3 text-xs text-ink-400">
                {t(l.team_size === 2 ? "pairsCount" : "playersCount", { n: l.entryCount, max: l.max_entries })}
              </p>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <LeagueForm
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            const result = await createLeague(input);
            if (result.id) router.push(`/admin/leagues/${result.id}`);
            return result;
          }}
        />
      )}
    </div>
  );
}
