"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Plus, Shuffle } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import SocialForm, { type ClubCourt } from "@/components/americano/SocialForm";
import { createSocial } from "@/app/[locale]/admin/americano/actions";
import { useLabels } from "@/hooks/useLabels";
import { BADGE } from "@/lib/badges";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import { dateLocale } from "@/lib/dateLocale";
import type { SocialEvent } from "@/lib/americano";
import { useReadOnly } from "@/components/admin/ReadOnly";

export type SocialRow = SocialEvent & { playerCount: number };

export default function SocialsClient({ events, courts }: { events: SocialRow[]; courts: ClubCourt[] }) {
  const t = useTranslations("americano");
  const { readOnly, hint } = useReadOnly();
  const labels = useLabels();
  const df = dateLocale(useLocale());
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">{t("title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-400">{t("subtitle")}</p>
        </div>
        <button title={hint} disabled={readOnly} type="button" onClick={() => setCreating(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} aria-hidden="true" />
          {t("new")}
        </button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white px-6 py-14 text-center">
          <Shuffle size={28} className="mx-auto mb-3 text-ink-200" aria-hidden="true" />
          <p className="text-base font-semibold text-ink-900">{t("empty")}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Link key={e.id} href={`/admin/americano/${e.id}`} className="rounded-2xl border border-ink-100 bg-white p-5 transition-colors hover:border-ink-900">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-ink-900">{e.name}</p>
                <span className={`${BADGE} shrink-0 ${LEAGUE_STATUS_TONE[e.status]}`}>{t(`status.${e.status}`)}</span>
              </div>
              <p className="mt-1 text-sm text-ink-600">
                {t(`formats.${e.format}`)} · {labels.sport(e.sport)} ·{" "}
                {format(new Date(e.starts_at), "EEE d MMM, HH:mm", { locale: df })}
              </p>
              <p className="mt-3 text-xs text-ink-400">{t("playersCount", { n: e.playerCount, max: e.max_players })}</p>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <SocialForm
          courts={courts}
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            const r = await createSocial(input);
            if (r.id) {
              // Made, but a court couldn't be held: say so on its page.
              router.push(`/admin/americano/${r.id}${r.error ? `?held=${r.error}` : ""}`);
              return {};
            }
            return r;
          }}
        />
      )}
    </div>
  );
}
