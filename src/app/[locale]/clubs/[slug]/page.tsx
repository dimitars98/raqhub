import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Ban, Globe, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import { createClient } from "@/lib/supabase/server";
import type {
  Club,
  Coach,
  Court,
  MembershipPlan,
  Profile,
} from "@/types/database";
import { LogoMark } from "@/components/ui/Logo";
import Avatar from "@/components/ui/Avatar";
import { initials } from "@/lib/avatar";
import { getLabels } from "@/lib/getLabels";
import { BADGE, TOURNAMENT_STATUS_TONE } from "@/lib/badges";
import { dateLocale, intlLocale } from "@/lib/dateLocale";
import { closureWhen, type PublicClosure } from "@/lib/closures";
import { format } from "date-fns";
import type { Tournament } from "@/types/database";
import ClubGroups, { type PublicGroup } from "@/components/groups/ClubGroups";
import { LEAGUE_STATUS_TONE } from "@/components/leagues/LeagueStatus";
import type { League } from "@/lib/leagues";
import type { SocialEvent } from "@/lib/americano";
import BookingPaused from "@/components/ui/BookingPaused";
import CourtArt from "@/components/courts/CourtArt";
import { courtColor } from "@/lib/courtColors";
import MatchCard from "@/components/matches/MatchCard";
import { loadMyLevels } from "@/lib/myLevels";
import type { MatchCard as OpenMatch, MyLevel } from "@/lib/openMatches";

// The public page of one club: what a visitor sees before they have an account.
// Everything read here is allowed for logged-out visitors by the database
// rules (active clubs, active courts, active coaches with name and photo,
// plans). Booking itself always happens after signing in.

/** A moment some hours ago, for evenings that are still being played. */
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/** yyyy-mm-dd two weeks ago, for "recent" tournaments. */
const recentDate = () => new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);

type PublicClub = Pick<
  Club,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "address"
  | "city"
  | "phone"
  | "email"
  | "website"
  | "logo_url"
>;

type PublicCourt = Pick<
  Court,
  "id" | "name" | "sport" | "surface" | "is_indoor" | "price_per_hour" | "color"
>;

type PublicCoach = Pick<Coach, "id" | "bio" | "levels" | "price_per_hour"> & {
  profile: Pick<Profile, "full_name" | "avatar_url"> | null;
};

type Viewer = "visitor" | "player" | "admin";

const CLUB_COLUMNS =
  "id, name, slug, description, address, city, phone, email, website, logo_url";

// Only http(s) links are shown, so a club can't publish a javascript: link.
const safeWebsite = (value: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clubs")
    .select("name, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return { title: "RaqHub" };

  const t = await getTranslations("clubPage");
  return {
    title: `${data.name} · RaqHub`,
    description: data.description ?? t("metaDescription", { club: data.name }),
  };
}

export default async function ClubPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const t = await getTranslations("clubPage");

  const { data: clubData } = await supabase
    .from("clubs")
    .select(CLUB_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  const club = clubData as PublicClub | null;
  if (!club) notFound();

  const [
    { data: courtsData },
    { data: coachesData },
    { data: plansData },
    { data: tournamentsData },
    {
      data: { user },
    },
    { data: groupsData },
    { data: matchesData },
  ] = await Promise.all([
    supabase
      .from("courts")
      .select("id, name, sport, surface, is_indoor, price_per_hour, color, image_url")
      .eq("club_id", club.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("coaches")
      .select(
        "id, bio, levels, price_per_hour, profile:profiles(full_name, avatar_url)",
      )
      .eq("club_id", club.id)
      .eq("is_active", true)
      .order("price_per_hour"),
    supabase
      .from("membership_plans")
      .select("*")
      .eq("club_id", club.id)
      .order("price"),
    // Upcoming and running tournaments, plus ones from the last two weeks.
    supabase
      .from("tournaments")
      .select("id, name, sport, starts_on, status")
      .eq("club_id", club.id)
      .or(`status.neq.finished,starts_on.gte.${recentDate()}`)
      .order("starts_on")
      .limit(6),
    supabase.auth.getUser(),
    // Groups and drop-in clinics open to sign up online.
    supabase.rpc("public_groups", { p_club: club.id }),
    // Open matches looking for players.
    supabase.rpc("open_match_feed", { p_club: club.id, p_sport: null }),
  ]);
  const openMatches = ((matchesData ?? []) as unknown as OpenMatch[]).filter(
    (m) => m.mine || m.taken < m.max_players,
  );
  const groups = (groupsData ?? []) as unknown as PublicGroup[];
  // After the club's free trial ends, online booking pauses (20261025_trial_lock.sql).
  const { data: pausedData } = await supabase.rpc("paused_clubs", { p_clubs: [club.id] });
  const paused = (pausedData ?? []).length > 0;
  // Courts closed now or soon (20261027_court_closures.sql).
  const { data: closuresData } = await supabase.rpc("upcoming_club_closures", { p_club: club.id });
  const closures = (closuresData ?? []) as PublicClosure[];
  const tClosed = await getTranslations("closures");

  const courts = (courtsData ?? []) as unknown as PublicCourt[];
  const coaches = (coachesData ?? []) as unknown as PublicCoach[];
  const plans = (plansData ?? []) as unknown as MembershipPlan[];
  const tournaments = (tournamentsData ?? []) as Pick<
    Tournament,
    "id" | "name" | "sport" | "starts_on" | "status"
  >[];
  const tTour = await getTranslations("tournaments");
  // Leagues taking sign-ups or being played (20261028_leagues.sql).
  const { data: leaguesData } = await supabase
    .from("leagues")
    .select("id, name, sport, team_size, starts_on, status")
    .eq("club_id", club.id)
    .neq("status", "finished")
    .order("starts_on")
    .limit(6);
  const leagues = (leaguesData ?? []) as Pick<League, "id" | "name" | "sport" | "team_size" | "starts_on" | "status">[];
  const tLeague = await getTranslations("leagues");
  // Americano evenings taking sign-ups or being played (20261030_americano.sql).
  const { data: socialsData } = await supabase
    .from("social_events")
    .select("id, name, format, sport, starts_at, status")
    .eq("club_id", club.id)
    .neq("status", "finished")
    .gte("ends_at", hoursAgo(6))
    .order("starts_at")
    .limit(6);
  const socials = (socialsData ?? []) as Pick<SocialEvent, "id" | "name" | "format" | "sport" | "starts_at" | "status">[];
  const tSocial = await getTranslations("americano");
  const locale = await getLocale();
  const dfLocale = dateLocale(locale);

  // Who is looking decides which button they get.
  let viewer: Viewer = "visitor";
  let myName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    myName = (profile as Pick<Profile, "full_name"> | null)?.full_name ?? null;
    viewer = role === "club_admin" || role === "super_admin" ? "admin" : "player";
  }
  const myLevels: MyLevel[] = viewer === "player" && user ? await loadMyLevels(supabase, user.id) : [];
  const tm = await getTranslations("matches");

  const action =
    viewer === "admin"
      ? { href: "/admin/timetable", label: t("backToDashboard") }
      : paused
        ? null
        : viewer === "player"
          ? { href: `/book?club=${club.slug}`, label: t("bookCourt") }
          : { href: "/signup?role=player", label: t("signUpToBook") };

  const website = safeWebsite(club.website);
  const location = [club.address, club.city].filter(Boolean).join(", ");

  const labels = await getLabels();

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-ink-100 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-brand-900"
          >
            <LogoMark className="size-7" />
            RaqHub
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher size="sm" />
            {viewer === "visitor" && (
              <Link href="/login" className="btn-ghost whitespace-nowrap">
                {t("signIn")}
              </Link>
            )}
            {/* On phones the same button is at the bottom of the page. */}
            {action && (
              <Link
                href={action.href}
                className="btn-primary hidden whitespace-nowrap sm:inline-flex"
              >
                {action.label}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        {/* Club header */}
        <section className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-start">
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={club.logo_url}
              alt=""
              className="size-20 shrink-0 rounded-2xl border border-ink-100 object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-2xl font-bold text-brand-900"
            >
              {initials(club.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              {club.name}
            </h1>
            {location && (
              <p className="mb-3 flex items-center gap-1.5 text-base text-ink-600">
                <MapPin
                  size={16}
                  className="shrink-0 text-ink-400"
                  aria-hidden="true"
                />
                {location}
              </p>
            )}
            {club.description && (
              <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-ink-600">
                {club.description}
              </p>
            )}

            {(club.phone || club.email || website) && (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {club.phone && (
                  <a
                    href={`tel:${club.phone}`}
                    className="inline-flex items-center gap-1.5 text-ink-600 hover:text-brand-800"
                  >
                    <Phone size={14} aria-hidden="true" />
                    {club.phone}
                  </a>
                )}
                {club.email && (
                  <a
                    href={`mailto:${club.email}`}
                    className="inline-flex items-center gap-1.5 text-ink-600 hover:text-brand-800"
                  >
                    <Mail size={14} aria-hidden="true" />
                    {club.email}
                  </a>
                )}
                {website && (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-ink-600 hover:text-brand-800"
                  >
                    <Globe size={14} aria-hidden="true" />
                    {t("website")}
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {paused && (
          // The club's phone and email are right above, in the header.
          <BookingPaused className="mb-12" />
        )}

        {closures.length > 0 && !paused && (
          <section
            aria-labelledby="closures-title"
            className="mb-12 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-amber-900 ring-1 ring-amber-200">
              <Ban size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="closures-title" className="text-base font-semibold text-amber-950">
                {tClosed("publicTitle")}
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm leading-relaxed text-amber-900">
                {closures.map((c) => (
                  <li key={`${c.starts_at}-${c.ends_at}-${(c.courts ?? []).join()}`}>
                    <span className="font-semibold">{closureWhen(c, intlLocale(locale))}</span>
                    {" · "}
                    {c.courts?.length ? c.courts.join(", ") : tClosed("wholeClub")}
                    {" · "}
                    {tClosed(`reasons.${c.reason}`)}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Courts */}
        <section className="mb-12">
          <h2 className="mb-5 text-xl font-bold tracking-tight text-ink-900">
            {t("courtsTitle")}
          </h2>
          {!courts.length ? (
            <div className="card px-6 py-12 text-center text-sm text-ink-600">
              {t("courtsEmpty")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courts.map((court) => {
                // Players open the booking window for this court; visitors
                // sign in first and come back to it; the club's own admin
                // goes to the courts screen.
                const bookHref = `/book?club=${club.slug}&court=${court.id}`;
                const href = paused
                  ? null
                  : viewer === "admin"
                    ? "/admin/courts"
                    : viewer === "player"
                      ? bookHref
                      : `/login?redirectTo=${encodeURIComponent(`/${locale}${bookHref}`)}`;
                const inner = (
                  <>
                    <div className="relative h-24 w-full overflow-hidden">
                      <CourtArt court={court} />
                      <span className="absolute top-2.5 left-2.5 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                        {labels.sport(court.sport)}
                      </span>
                      <span className="absolute top-2.5 right-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink-900">
                        {labels.inOut(court.is_indoor)}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <div>
                        <p className="text-lg font-semibold leading-snug text-ink-900">{court.name}</p>
                        <p className="text-sm text-ink-600">
                          {labels.surface(court.surface)} · {labels.courtColor(courtColor(court))}
                        </p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-3">
                        <p className="text-xl font-bold tracking-tight text-ink-900">
                          €{court.price_per_hour}
                          <span className="text-sm font-normal tracking-normal text-ink-600"> {t("perHour")}</span>
                        </p>
                        {href && viewer !== "admin" && (
                          <span className="inline-flex h-9 items-center rounded-full bg-ink-900 px-4 text-[13px] font-semibold text-white transition-colors group-hover:bg-brand-600">
                            {t("bookThisCourt")} →
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );
                const box =
                  "group flex h-full flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white";
                return href ? (
                  <Link
                    key={court.id}
                    href={href}
                    className={`${box} transition-all hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-[0_12px_28px_-14px_rgba(17,28,10,0.35)] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={court.id} className={box}>
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Groups and clinics: only shown when the club has any open */}
        {groups.length > 0 && !paused && (
          <ClubGroups
            groups={groups}
            viewer={viewer}
            myName={myName}
            loginHref={`/login?redirectTo=${encodeURIComponent(`/${locale}/clubs/${club.slug}#groups`)}`}
          />
        )}

        {/* Open matches: only shown when some are looking for players */}
        {openMatches.length > 0 && !paused && viewer !== "admin" && (
          <section id="matches" className="mb-12">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink-900">{tm("clubSection")}</h2>
                <p className="mt-1 text-sm text-ink-600">{tm("clubSectionHint")}</p>
              </div>
              {viewer === "player" && (
                <Link href={`/matches?club=${club.slug}`} className="btn-secondary">
                  {tm("seeAll")}
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {openMatches.slice(0, 4).map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  myLevel={myLevels.find((l) => l.sport === m.sport)?.level ?? null}
                  viewer={viewer === "player" ? "player" : "visitor"}
                  showClub={false}
                  loginHref={`/login?redirectTo=${encodeURIComponent(`/${locale}/matches/${m.id}`)}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Tournaments: only shown when the club has any coming up */}
        {tournaments.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-xl font-bold tracking-tight text-ink-900">
              {tTour("public.upcoming")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((tour) => (
                <Link
                  key={tour.id}
                  href={`/tournaments/${tour.id}`}
                  className="card flex flex-col p-5 transition-colors hover:border-ink-900"
                >
                  <span className={`${BADGE} w-fit ${TOURNAMENT_STATUS_TONE[tour.status]}`}>
                    {tTour(`status.${tour.status}`)}
                  </span>
                  <span className="mt-3 text-lg font-semibold text-ink-900">{tour.name}</span>
                  <span className="mt-1 text-sm text-ink-600">
                    {labels.sport(tour.sport)} ·{" "}
                    {format(new Date(`${tour.starts_on}T12:00:00`), "d MMM yyyy", {
                      locale: dfLocale,
                    })}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Leagues: only shown when the club has one open or running */}
        {leagues.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-xl font-bold tracking-tight text-ink-900">{tLeague("public.clubTitle")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {leagues.map((l) => (
                <Link
                  key={l.id}
                  href={`/leagues/${l.id}`}
                  className="card flex flex-col p-5 transition-colors hover:border-ink-900"
                >
                  <span className={`${BADGE} w-fit ${LEAGUE_STATUS_TONE[l.status]}`}>{tLeague(`status.${l.status}`)}</span>
                  <span className="mt-3 text-lg font-semibold text-ink-900">{l.name}</span>
                  <span className="mt-1 text-sm text-ink-600">
                    {labels.sport(l.sport)} · {l.team_size === 2 ? tLeague("form.pairs") : tLeague("form.singles")} ·{" "}
                    {format(new Date(`${l.starts_on}T12:00:00`), "d MMM yyyy", { locale: dfLocale })}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Americano evenings: only shown when the club has one coming up */}
        {socials.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-xl font-bold tracking-tight text-ink-900">{tSocial("public.clubTitle")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {socials.map((e) => (
                <Link key={e.id} href={`/americano/${e.id}`} className="card flex flex-col p-5 transition-colors hover:border-ink-900">
                  <span className={`${BADGE} w-fit ${LEAGUE_STATUS_TONE[e.status]}`}>{tSocial(`status.${e.status}`)}</span>
                  <span className="mt-3 text-lg font-semibold text-ink-900">{e.name}</span>
                  <span className="mt-1 text-sm text-ink-600">
                    {tSocial(`formats.${e.format}`)} · {labels.sport(e.sport)} ·{" "}
                    {format(new Date(e.starts_at), "EEE d MMM, HH:mm", { locale: dfLocale })}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Coaches: only shown when the club has any */}
        {coaches.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-xl font-bold tracking-tight text-ink-900">
              {t("coachesTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map((coach) => (
                <div key={coach.id} className="card flex flex-col p-6">
                  <div className="mb-4 flex items-center gap-4">
                    <Avatar
                      id={coach.id}
                      name={coach.profile?.full_name}
                      src={coach.profile?.avatar_url}
                      className="size-14 text-base"
                      px={56}
                    />
                    <div className="min-w-0 truncate text-lg font-semibold leading-snug text-ink-900">
                      {coach.profile?.full_name ?? t("coach")}
                    </div>
                  </div>

                  {coach.bio && (
                    <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-ink-600">
                      {coach.bio}
                    </p>
                  )}

                  {(coach.levels ?? []).length > 0 && (
                    <div className="mb-5 flex flex-wrap gap-1.5">
                      {(coach.levels ?? []).map((level) => (
                        <span
                          key={level}
                          className="badge bg-ink-50 text-ink-800"
                        >
                          {labels.level(level)}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto border-t border-ink-100 pt-4 text-xl font-bold tracking-tight text-ink-900">
                    €{coach.price_per_hour}
                    <span className="text-sm font-normal tracking-normal text-ink-600">
                      {" "}
                      {t("perHour")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Membership plans: only shown when the club has any */}
        {plans.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-5 text-xl font-bold tracking-tight text-ink-900">
              {t("plansTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className="card flex flex-col p-6">
                  <div className="mb-1 text-lg font-semibold text-ink-900">
                    {plan.name}
                  </div>
                  <div className="mb-3 text-xl font-bold tracking-tight text-ink-900">
                    €{plan.price}
                    <span className="text-sm font-normal tracking-normal text-ink-600">
                      {" "}
                      {labels.billingPeriod(plan.billing_period)}
                    </span>
                  </div>
                  {plan.description && (
                    <p className="mb-3 text-sm leading-relaxed text-ink-600">
                      {plan.description}
                    </p>
                  )}
                  {plan.discount_pct > 0 && (
                    <div className="mt-auto">
                      <span className="badge-brand">
                        {t("discount", { pct: plan.discount_pct })}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-ink-600">{t("plansNote")}</p>
          </section>
        )}

        {/* Call to action */}
        <section className="rounded-2xl bg-ink-900 px-6 py-10 text-center sm:px-10">
          <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">
            {t("ctaTitle", { club: club.name })}
          </h2>
          {viewer === "visitor" && !paused && (
            <p className="mx-auto mb-6 max-w-xl text-sm text-ink-200">
              {t("ctaText")}
            </p>
          )}
          {action ? (
            <Link
              href={action.href}
              className={`inline-flex items-center rounded-full bg-brand-400 px-6 py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-brand-200 ${viewer === "visitor" ? "" : "mt-4"}`}
            >
              {action.label}
            </Link>
          ) : (
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-200">{t("pausedCta")}</p>
          )}
        </section>
      </main>
    </>
  );
}
