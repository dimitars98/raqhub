import type { Metadata } from "next";
import { eventMetadata, loadEventCard } from "@/lib/sharePreview";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { CalendarDays, MapPin, Tag, Users } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/landing/Footer";
import Bracket from "@/components/tournaments/Bracket";
import SignUpBox from "@/components/tournaments/SignUpBox";
import { AboutCard, EntryList, EventBody, EventHero, Fact, pickTab } from "@/components/events/EventPage";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/getLabels";
import { dateLocale } from "@/lib/dateLocale";
import { TOURNAMENT_STATUS_TONE } from "@/lib/badges";
import { entryName } from "@/lib/tournament";
import type { Sport, Tournament, TournamentEntry, TournamentMatch } from "@/types/database";

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

// Title, description and the picture shown when the link is shared.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  return eventMetadata(await loadEventCard("tournament", id), locale);
}

/** A tournament's public page: details, sign-up, players and the draw. */
export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: asked } = await searchParams;
  const { supabase, tournament } = await load(id);
  if (!tournament) notFound();

  const t = await getTranslations("tournaments");
  const tp = await getTranslations("eventPage");
  const labels = await getLabels();
  const locale = await getLocale();

  const [{ data: entryData }, { data: matchData }, { data: auth }, { data: clubRow }] = await Promise.all([
    supabase.from("tournament_entries").select("*").eq("tournament_id", id).order("created_at"),
    supabase.from("tournament_matches").select("*").eq("tournament_id", id),
    supabase.auth.getUser(),
    tournament.club
      ? supabase.from("clubs").select("logo_url").eq("slug", tournament.club.slug).maybeSingle()
      : Promise.resolve({ data: null }),
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

  const sport = tournament.sport as Sport;
  const pairs = tournament.team_size === 2;
  // Once the draw is made, it's what people come for. No details: no Overview.
  const keys = [
    ...(matches.length ? (["draw"] as const) : []),
    "players" as const,
    ...(tournament.description ? (["overview"] as const) : []),
  ];
  if (!matches.length && tournament.description) keys.unshift(keys.pop()!);
  const tab = pickTab([...keys], asked);
  const tabLabel = {
    draw: t("manage.bracket"),
    players: t("public.players", { n: entries.length }),
    overview: tp("tabOverview"),
  };

  return (
    // Fills the screen, so the footer stays at the bottom on short pages.
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <EventHero
        sport={sport}
        sportLabel={labels.sport(sport)}
        status={{ label: t(`status.${tournament.status}`), tone: TOURNAMENT_STATUS_TONE[tournament.status] }}
        name={tournament.name}
        club={tournament.club ?? { name: "RaqHub", slug: "" }}
        logo={(clubRow as { logo_url: string | null } | null)?.logo_url ?? null}
        cover={tournament.cover_url ?? null}
        organizedBy={tp("organizedBy")}
      >
        <Fact icon={<CalendarDays size={18} />} label={tp("factDate")} value={date} />
        {tournament.club && (
          <Fact
            icon={<MapPin size={18} />}
            label={tp("factLocation")}
            value={tournament.club.name}
            sub={tournament.club.city}
          />
        )}
        <Fact
          icon={<Tag size={18} />}
          label={tp("factEntry")}
          value={tournament.entry_fee ? `€${tournament.entry_fee}` : tp("entryFree")}
          sub={`${labels.sport(sport)} · ${pairs ? tp("pairs") : tp("singles")}`}
        />
        <Fact
          icon={<Users size={18} />}
          label={tp("factSpots")}
          value={t("entriesCount", { n: entries.length, max: tournament.max_entries })}
        />
      </EventHero>

      <EventBody
        tabs={keys.map((k) => ({ key: k, label: tabLabel[k] }))}
        active={tab}
        base={`/tournaments/${tournament.id}`}
        label={tournament.name}
        aside={
          <SignUpBox
            tournamentId={tournament.id}
            signedIn={!!user}
            myEntryName={mine ? entryName(mine) : null}
            pairs={pairs}
            defaultName={defaultName}
            open={tournament.status === "open" && !paused}
            full={entries.length >= tournament.max_entries}
          />
        }
      >
        {tab === "overview" && tournament.description && (
          <AboutCard title={tp("aboutTournament")}>
            <p className="whitespace-pre-line">{tournament.description}</p>
          </AboutCard>
        )}
        {tab === "players" && (
          <EntryList
            entries={entries.map((e) => ({
              id: e.id,
              name: e.name,
              partner: e.partner_name,
              mine: !!user && e.player_id === user.id,
            }))}
            empty={t("public.noPlayers")}
          />
        )}
        {tab === "draw" && (
          <div className="overflow-x-auto rounded-3xl border border-ink-100 bg-white p-4 sm:p-6">
            <Bracket matches={matches} entries={entries} />
          </div>
        )}
      </EventBody>

      <Footer />
    </div>
  );
}
