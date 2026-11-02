import type { Metadata } from "next";
import { eventMetadata, loadEventCard } from "@/lib/sharePreview";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { CalendarDays, MapPin, Tag, Users } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/landing/Footer";
import SocialSignUp from "@/components/americano/SocialSignUp";
import SocialLive from "@/components/americano/SocialLive";
import { AboutCard, EntryList, EventBody, EventHero, Fact, pickTab } from "@/components/events/EventPage";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/getLabels";
import { dateLocale } from "@/lib/dateLocale";
import { byePoints, type SocialView } from "@/lib/americano";
import type { Sport } from "@/types/database";

async function load(id: string) {
  const supabase = await createClient();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { supabase, view: null };
  const { data } = await supabase.rpc("social_view", { p_event: id });
  return { supabase, view: data as unknown as SocialView | null };
}

// Title, description and the picture shown when the link is shared.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  return eventMetadata(await loadEventCard("americano", id), locale);
}

/** An evening's public page: details, sign-up, then the live rounds and table. */
export default async function SocialPage({
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

  const t = await getTranslations("americano");
  const tp = await getTranslations("eventPage");
  const labels = await getLabels();
  const df = dateLocale(await getLocale());
  const { event, club } = view;
  const active = view.players.filter((p) => p.status === "active");
  const mine = view.players.find((p) => p.mine);

  const [{ data: auth }, { data: paused }, { data: clubRow }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("club_locked", { p_club: event.club_id }),
    supabase.from("clubs").select("logo_url").eq("slug", club.slug).maybeSingle(),
  ]);
  let defaultName = "";
  if (auth.user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
    defaultName = profile?.full_name ?? "";
  }

  const when = `${format(new Date(event.starts_at), "EEEE d MMMM, HH:mm", { locale: df })}–${format(new Date(event.ends_at), "HH:mm")}`;
  const levels =
    event.level_min != null || event.level_max != null
      ? t("levelRange", { min: Number(event.level_min ?? 1).toFixed(1), max: Number(event.level_max ?? 7).toFixed(1) })
      : null;
  const signUp = (
    <SocialSignUp
      eventId={event.id}
      signedIn={!!auth.user}
      myName={mine?.name ?? null}
      defaultName={defaultName}
      status={event.status}
      full={active.length >= event.max_players}
      paused={!!paused}
    />
  );

  const sport = event.sport as Sport;
  // Once round 1 is on, the live rounds and table are what people come for.
  const keys = view.matches.length ? (["results", "players", "overview"] as const) : (["overview", "players"] as const);
  const tab = pickTab([...keys], asked);
  const tabLabel = { overview: tp("tabOverview"), results: tp("tabResults"), players: t("public.playersTitle", { n: active.length }) };

  return (
    // Fills the screen, so the footer stays at the bottom on short pages.
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <EventHero
        sport={sport}
        sportLabel={labels.sport(sport)}
        status={{ label: t(`status.${event.status}`), tone: LEAGUE_STATUS_TONE[event.status] }}
        name={event.name}
        club={club}
        logo={(clubRow as { logo_url: string | null } | null)?.logo_url ?? null}
        organizedBy={tp("organizedBy")}
      >
        <Fact icon={<CalendarDays size={18} />} label={tp("factDate")} value={when} />
        <Fact icon={<MapPin size={18} />} label={tp("factLocation")} value={club.name} sub={club.city} />
        <Fact
          icon={<Tag size={18} />}
          label={tp("factEntry")}
          value={event.entry_fee ? `€${event.entry_fee}` : tp("entryFree")}
          sub={`${t(`formats.${event.format}`)} · ${labels.sport(sport)}`}
        />
        <Fact
          icon={<Users size={18} />}
          label={t("players")}
          value={t("playersCount", { n: active.length, max: event.max_players })}
          sub={levels}
        />
      </EventHero>

      <EventBody
        tabs={keys.map((k) => ({ key: k, label: tabLabel[k] }))}
        active={tab}
        base={`/americano/${event.id}`}
        label={event.name}
        aside={signUp}
      >
        {tab === "overview" && (
          <AboutCard title={tp("aboutEvening")}>
            {event.description && <p className="whitespace-pre-line">{event.description}</p>}
            <p>{t(`public.how.${event.format}`, { points: event.points_per_match, bye: byePoints(event.points_per_match) })}</p>
          </AboutCard>
        )}
        {tab === "players" && (
          <EntryList
            entries={active.map((p) => ({ id: p.id, name: p.name, mine: p.mine }))}
            empty={t("public.noPlayers")}
          />
        )}
        {tab === "results" && <SocialLive view={view} />}
      </EventBody>

      <Footer />
    </div>
  );
}
