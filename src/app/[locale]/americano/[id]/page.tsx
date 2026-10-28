import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { CalendarDays, Gauge, MapPin, Users } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/landing/Footer";
import SocialSignUp from "@/components/americano/SocialSignUp";
import SocialLive from "@/components/americano/SocialLive";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/getLabels";
import { dateLocale } from "@/lib/dateLocale";
import { BADGE } from "@/lib/badges";
import { byePoints, type SocialView } from "@/lib/americano";

async function load(id: string) {
  const supabase = await createClient();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { supabase, view: null };
  const { data } = await supabase.rpc("social_view", { p_event: id });
  return { supabase, view: data as unknown as SocialView | null };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { view } = await load(id);
  if (!view) return {};
  return { title: `${view.event.name} · ${view.club.name}` };
}

/** An evening's public page: details, sign-up, then the live rounds and table. */
export default async function SocialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, view } = await load(id);
  if (!view) notFound();

  const t = await getTranslations("americano");
  const labels = await getLabels();
  const df = dateLocale(await getLocale());
  const { event, club } = view;
  const active = view.players.filter((p) => p.status === "active");
  const mine = view.players.find((p) => p.mine);

  const [{ data: auth }, { data: paused }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("club_locked", { p_club: event.club_id }),
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

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-10 lg:py-14">
        <div className="mb-8">
          <span className={`${BADGE} ${LEAGUE_STATUS_TONE[event.status]}`}>{t(`status.${event.status}`)}</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">{event.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={15} className="text-ink-400" aria-hidden="true" />
              <span className="first-letter:uppercase">{when}</span>
            </span>
            <Link href={`/clubs/${club.slug}`} className="inline-flex items-center gap-1.5 hover:text-ink-900">
              <MapPin size={15} className="text-ink-400" aria-hidden="true" />
              {club.name}
              {club.city ? ` · ${club.city}` : ""}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <Users size={15} className="text-ink-400" aria-hidden="true" />
              {t("playersCount", { n: active.length, max: event.max_players })}
            </span>
            {levels && (
              <span className="inline-flex items-center gap-1.5">
                <Gauge size={15} className="text-ink-400" aria-hidden="true" />
                {levels}
              </span>
            )}
            <span>
              {t(`formats.${event.format}`)} · {labels.sport(event.sport)} ·{" "}
              {event.entry_fee ? t("fee", { fee: event.entry_fee }) : t("free")}
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-sm text-ink-600">
            {t(`public.how.${event.format}`, { points: event.points_per_match, bye: byePoints(event.points_per_match) })}
          </p>
          {event.description && (
            <p className="mt-3 max-w-2xl whitespace-pre-line text-base leading-relaxed text-ink-600">{event.description}</p>
          )}
        </div>

        {view.matches.length > 0 ? (
          <div className="flex flex-col gap-6">
            {mine && <div className="max-w-sm">{signUp}</div>}
            <SocialLive view={view} />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <section>
              <h2 className="mb-3 text-xl font-semibold text-ink-900">{t("public.playersTitle", { n: active.length })}</h2>
              {active.length === 0 ? (
                <p className="text-sm text-ink-400">{t("public.noPlayers")}</p>
              ) : (
                <ol className="grid gap-2 sm:grid-cols-2">
                  {active.map((p, i) => (
                    <li key={p.id} className="rounded-xl border border-ink-100 bg-white px-4 py-2.5 text-sm">
                      <span className="mr-2 tabular-nums text-ink-400">{i + 1}.</span>
                      <span className="font-medium text-ink-900">{p.name}</span>
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
