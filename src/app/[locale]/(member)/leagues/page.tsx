import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { Layers } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/getLabels";
import { dateLocale } from "@/lib/dateLocale";
import { BADGE } from "@/lib/badges";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import type { LeagueStatus } from "@/lib/leagues";
import type { Sport } from "@/types/database";

type Card = {
  id: string;
  name: string;
  sport: Sport;
  status: LeagueStatus;
  starts_on: string;
  club: string;
  /** How they signed up: "Ana / Marko". */
  entry?: string;
};

/** A player's leagues, and open ones at the clubs they play at. */
export default async function MyLeaguesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("my_leagues");
  if (error) console.error("[my leagues]", error);
  const { mine = [], open = [] } = (data ?? {}) as { mine?: Card[]; open?: Card[] };

  const t = await getTranslations("leagues");
  const labels = await getLabels();
  const df = dateLocale(await getLocale());

  const list = (cards: Card[]) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((l) => (
        <Link
          key={l.id}
          href={`/leagues/${l.id}`}
          className="rounded-2xl border border-ink-100 bg-white p-5 transition-colors hover:border-ink-900"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-ink-900">{l.name}</p>
            <span className={`${BADGE} shrink-0 ${LEAGUE_STATUS_TONE[l.status]}`}>{t(`status.${l.status}`)}</span>
          </div>
          <p className="mt-1 text-sm text-ink-600">
            {l.club} · {labels.sport(l.sport)} · {format(new Date(`${l.starts_on}T12:00:00`), "d MMM", { locale: df })}
          </p>
          {l.entry && <p className="mt-3 text-xs text-ink-400">{t("mine.as", { name: l.entry })}</p>}
        </Link>
      ))}
    </div>
  );

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-900">{t("mine.title")}</h1>
      <p className="mt-1 max-w-xl text-sm text-ink-400">{t("mine.subtitle")}</p>

      <section className="mt-6">
        {mine.length === 0 ? (
          <div className="rounded-2xl border border-ink-100 bg-white px-6 py-12 text-center">
            <Layers size={28} className="mx-auto mb-3 text-ink-200" aria-hidden="true" />
            <p className="text-base font-semibold text-ink-900">{t("mine.empty")}</p>
            <p className="mt-1 text-sm text-ink-400">{t("mine.emptyHint")}</p>
          </div>
        ) : (
          list(mine)
        )}
      </section>

      {open.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-ink-900">{t("mine.openTitle")}</h2>
          {list(open)}
        </section>
      )}
    </div>
  );
}
