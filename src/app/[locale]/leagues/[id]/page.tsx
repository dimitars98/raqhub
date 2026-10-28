import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { CalendarDays, Gauge, MapPin, Users } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/landing/Footer";
import LeagueSignUp from "@/components/leagues/LeagueSignUp";
import LeagueRounds from "@/components/leagues/LeagueRounds";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/getLabels";
import { dateLocale } from "@/lib/dateLocale";
import { BADGE } from "@/lib/badges";
import { entryName, type LeagueView } from "@/lib/leagues";

async function load(id: string) {
  const supabase = await createClient();
  // Not a uuid: no such league (and no database error).
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { supabase, view: null };
  const { data } = await supabase.rpc("league_view", { p_league: id });
  return { supabase, view: data as unknown as LeagueView | null };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { view } = await load(id);
  if (!view) return {};
  return { title: `${view.league.name} · ${view.club.name}` };
}

/** A league's public page: details, sign-up, players, boxes and results. */
export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, view } = await load(id);
  if (!view) notFound();

  const t = await getTranslations("leagues");
  const labels = await getLabels();
  const locale = await getLocale();
  const { league, club, entries, rounds } = view;
  const pairs = league.team_size === 2;
  const active = entries.filter((e) => e.status === "active");
  const mine = entries.find((e) => e.mine);

  const [{ data: auth }, { data: paused }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("club_locked", { p_club: league.club_id }),
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

  const signUp = (
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
  );

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10 lg:py-14">
        <div className="mb-8">
          <span className={`${BADGE} ${LEAGUE_STATUS_TONE[league.status]}`}>{t(`status.${league.status}`)}</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">{league.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={15} className="text-ink-400" aria-hidden="true" />
              {t("startsOn", { date })}
            </span>
            <Link href={`/clubs/${club.slug}`} className="inline-flex items-center gap-1.5 hover:text-ink-900">
              <MapPin size={15} className="text-ink-400" aria-hidden="true" />
              {club.name}
              {club.city ? ` · ${club.city}` : ""}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <Users size={15} className="text-ink-400" aria-hidden="true" />
              {t(pairs ? "pairsCount" : "playersCount", { n: active.length, max: league.max_entries })}
            </span>
            {levels && (
              <span className="inline-flex items-center gap-1.5">
                <Gauge size={15} className="text-ink-400" aria-hidden="true" />
                {levels}
              </span>
            )}
            <span>
              {labels.sport(league.sport)} · {pairs ? t("form.pairs") : t("form.singles")} ·{" "}
              {league.entry_fee ? t("fee", { fee: league.entry_fee }) : t("free")}
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-ink-600">
            {t("public.howItWorks", { weeks: league.round_weeks, size: league.box_size, move: league.move_count })}
          </p>
          {league.description && (
            <p className="mt-3 max-w-2xl whitespace-pre-line text-base leading-relaxed text-ink-600">{league.description}</p>
          )}
        </div>

        {rounds.length > 0 ? (
          <div className="flex flex-col gap-6">
            {mine && <div className="max-w-sm">{signUp}</div>}
            <LeagueRounds rounds={rounds} entries={entries} moveCount={league.move_count} />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <section>
              <h2 className="mb-3 text-xl font-semibold text-ink-900">
                {t(pairs ? "public.pairsTitle" : "public.playersTitle", { n: active.length })}
              </h2>
              {active.length === 0 ? (
                <p className="text-sm text-ink-400">{t("public.noPlayers")}</p>
              ) : (
                <ol className="grid gap-2 sm:grid-cols-2">
                  {active.map((e, i) => (
                    <li key={e.id} className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm">
                      <span className="mr-2 tabular-nums text-ink-400">{i + 1}.</span>
                      <span className="font-medium text-ink-900">{entryName(e)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <aside>{signUp}</aside>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
