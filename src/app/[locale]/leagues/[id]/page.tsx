import type { Metadata } from "next";
import { eventMetadata, loadEventCard } from "@/lib/sharePreview";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { CalendarDays, MapPin, Tag, Users } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/landing/Footer";
import LeagueSignUp from "@/components/leagues/LeagueSignUp";
import LeagueRounds from "@/components/leagues/LeagueRounds";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import { AboutCard, EntryList, EventBody, EventHero, Fact, pickTab } from "@/components/events/EventPage";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/getLabels";
import { dateLocale } from "@/lib/dateLocale";
import { entryName, type LeagueView } from "@/lib/leagues";
import type { Sport } from "@/types/database";

async function load(id: string) {
  const supabase = await createClient();
  // Not a uuid: no such league (and no database error).
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { supabase, view: null };
  const { data } = await supabase.rpc("league_view", { p_league: id });
  return { supabase, view: data as unknown as LeagueView | null };
}

// Title, description and the picture shown when the link is shared.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  return eventMetadata(await loadEventCard("league", id), locale);
}

/**
 * A league's public page: anyone can see it without an account (shared in
 * WhatsApp groups, found on Google); joining needs one. Details on top, then
 * tabs for the overview, the players and the boxes with results.
 */
export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: asked } = await searchParams;
  const { supabase, view } = await load(id);
  if (!view) notFound();

  const t = await getTranslations("leagues");
  const tp = await getTranslations("eventPage");
  const labels = await getLabels();
  const locale = await getLocale();
  const { league, club, entries, rounds } = view;
  const pairs = league.team_size === 2;
  const active = entries.filter((e) => e.status === "active");
  const mine = entries.find((e) => e.mine);
  const sport = league.sport as Sport;

  const [{ data: auth }, { data: paused }, { data: clubRow }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("club_locked", { p_club: league.club_id }),
    supabase.from("clubs").select("logo_url").eq("slug", club.slug).maybeSingle(),
  ]);
  const user = auth.user;
  let defaultName = "";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    defaultName = profile?.full_name ?? "";
  }

  const date = format(new Date(`${league.starts_on}T12:00:00`), "EEEE, d MMMM yyyy", { locale: dateLocale(locale) });
  const levels =
    league.level_min != null || league.level_max != null
      ? t("levelRange", {
          min: Number(league.level_min ?? 1).toFixed(1),
          max: Number(league.level_max ?? 7).toFixed(1),
        })
      : null;

  // Once rounds are on, the results are what people come for.
  const keys = rounds.length ? (["results", "players", "overview"] as const) : (["overview", "players"] as const);
  const tab = pickTab([...keys], asked);
  const tabLabel = { overview: tp("tabOverview"), results: tp("tabResults"), players: `${t(pairs ? "pairs" : "players")} (${active.length})` };

  return (
    // Fills the screen, so the footer stays at the bottom on short pages.
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <EventHero
        sport={sport}
        sportLabel={labels.sport(sport)}
        status={{ label: t(`status.${league.status}`), tone: LEAGUE_STATUS_TONE[league.status] }}
        name={league.name}
        club={club}
        logo={(clubRow as { logo_url: string | null } | null)?.logo_url ?? null}
        cover={league.cover_url ?? null}
        organizedBy={tp("organizedBy")}
      >
        <Fact
          icon={<CalendarDays size={18} />}
          label={tp("factDates")}
          value={t("startsOn", { date })}
          sub={t("summary", { weeks: league.round_weeks, size: league.box_size })}
        />
        <Fact icon={<MapPin size={18} />} label={tp("factLocation")} value={club.name} sub={club.city} />
        <Fact
          icon={<Tag size={18} />}
          label={tp("factEntry")}
          value={league.entry_fee ? `€${league.entry_fee}` : tp("entryFree")}
          sub={`${labels.sport(sport)} · ${pairs ? tp("pairs") : tp("singles")}`}
        />
        <Fact
          icon={<Users size={18} />}
          label={t(pairs ? "pairs" : "players")}
          value={t(pairs ? "pairsCount" : "playersCount", { n: active.length, max: league.max_entries })}
          sub={levels}
        />
      </EventHero>

      <EventBody
        tabs={keys.map((k) => ({ key: k, label: tabLabel[k] }))}
        active={tab}
        base={`/leagues/${league.id}`}
        label={league.name}
        aside={
          <LeagueSignUp
            leagueId={league.id}
            pairs={pairs}
            signedIn={!!user}
            myEntryName={mine ? entryName(mine) : null}
            defaultName={defaultName}
            status={league.status}
            full={active.length >= league.max_entries}
            paused={!!paused}
          />
        }
      >
        {tab === "overview" && (
          <AboutCard title={tp("aboutLeague")}>
            {league.description && <p className="whitespace-pre-line">{league.description}</p>}
            <p>{t("public.howItWorks", { weeks: league.round_weeks, size: league.box_size, move: league.move_count })}</p>
          </AboutCard>
        )}
        {tab === "players" && (
          <EntryList
            entries={active.map((e) => ({ id: e.id, name: e.name, partner: e.partner_name, mine: e.mine }))}
            empty={t("public.noPlayers")}
          />
        )}
        {tab === "results" && <LeagueRounds rounds={rounds} entries={entries} moveCount={league.move_count} />}
      </EventBody>

      <Footer />
    </div>
  );
}
