import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { CalendarDays, MapPin, Users } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/landing/Footer";
import Bracket from "@/components/tournaments/Bracket";
import SignUpBox from "@/components/tournaments/SignUpBox";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/getLabels";
import { dateLocale } from "@/lib/dateLocale";
import { BADGE, TOURNAMENT_STATUS_TONE } from "@/lib/badges";
import { entryName } from "@/lib/tournament";
import type { Tournament, TournamentEntry, TournamentMatch } from "@/types/database";

type TournamentWithClub = Tournament & {
  club: { name: string; slug: string; city: string | null } | null;
};

async function load(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournaments")
    .select("*, club:clubs(name, slug, city)")
    .eq("id", id)
    .maybeSingle();
  return { supabase, tournament: data as unknown as TournamentWithClub | null };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { tournament } = await load(id);
  if (!tournament) return {};
  return { title: `${tournament.name} · ${tournament.club?.name ?? "RaqHub"}` };
}

/** A tournament's public page: details, sign-up, players and the draw. */
export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, tournament } = await load(id);
  if (!tournament) notFound();

  const t = await getTranslations("tournaments");
  const labels = await getLabels();
  const locale = await getLocale();

  const [{ data: entryData }, { data: matchData }, { data: auth }] = await Promise.all([
    supabase.from("tournament_entries").select("*").eq("tournament_id", id).order("created_at"),
    supabase.from("tournament_matches").select("*").eq("tournament_id", id),
    supabase.auth.getUser(),
  ]);
  const entries = (entryData ?? []) as TournamentEntry[];
  const matches = (matchData ?? []) as TournamentMatch[];
  const user = auth.user;

  let defaultName = "";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    defaultName = profile?.full_name ?? "";
  }
  const mine = user ? entries.find((e) => e.player_id === user.id) : undefined;
  // No new sign-ups while the club's account is paused after its free trial.
  const { data: paused } = await supabase.rpc("club_locked", { p_club: tournament.club_id });
  const date = format(new Date(`${tournament.starts_on}T12:00:00`), "EEEE, d MMMM yyyy", {
    locale: dateLocale(locale),
  });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10 lg:py-14">
        <div className="mb-8">
          <span className={`${BADGE} ${TOURNAMENT_STATUS_TONE[tournament.status]}`}>
            {t(`status.${tournament.status}`)}
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            {tournament.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={15} className="text-ink-400" aria-hidden="true" />
              {date}
            </span>
            {tournament.club && (
              <Link
                href={`/clubs/${tournament.club.slug}`}
                className="inline-flex items-center gap-1.5 hover:text-ink-900"
              >
                <MapPin size={15} className="text-ink-400" aria-hidden="true" />
                {tournament.club.name}
                {tournament.club.city ? ` · ${tournament.club.city}` : ""}
              </Link>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users size={15} className="text-ink-400" aria-hidden="true" />
              {t("entriesCount", { n: entries.length, max: tournament.max_entries })}
            </span>
            <span>
              {labels.sport(tournament.sport)} ·{" "}
              {tournament.entry_fee ? t("fee", { fee: tournament.entry_fee }) : t("free")}
            </span>
          </div>
          {tournament.description && (
            <p className="mt-5 max-w-2xl whitespace-pre-line text-base leading-relaxed text-ink-600">
              {tournament.description}
            </p>
          )}
        </div>

        {matches.length > 0 ? (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-ink-900">{t("manage.bracket")}</h2>
            <Bracket matches={matches} entries={entries} />
          </section>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <section>
              <h2 className="mb-3 text-xl font-semibold text-ink-900">
                {t("public.players", { n: entries.length })}
              </h2>
              {entries.length === 0 ? (
                <p className="text-sm text-ink-400">{t("public.noPlayers")}</p>
              ) : (
                <ol className="grid gap-2 sm:grid-cols-2">
                  {entries.map((e, i) => (
                    <li key={e.id} className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm">
                      <span className="mr-2 tabular-nums text-ink-400">{i + 1}.</span>
                      <span className="font-medium text-ink-900">{entryName(e)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <aside>
              <SignUpBox
                tournamentId={tournament.id}
                signedIn={!!user}
                myEntryName={mine ? entryName(mine) : null}
                pairs={tournament.team_size === 2}
                defaultName={defaultName}
                open={tournament.status === "open" && !paused}
                full={entries.length >= tournament.max_entries}
              />
            </aside>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
