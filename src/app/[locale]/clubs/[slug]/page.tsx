import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
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
import { dateLocale } from "@/lib/dateLocale";
import { format } from "date-fns";
import type { Tournament } from "@/types/database";
import ClubGroups, { type PublicGroup } from "@/components/groups/ClubGroups";
import BookingPaused from "@/components/ui/BookingPaused";

// The public page of one club: what a visitor sees before they have an account.
// Everything read here is allowed for logged-out visitors by the database
// rules (active clubs, active courts, active coaches with name and photo,
// plans). Booking itself always happens after signing in.

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
  "id" | "name" | "sport" | "surface" | "is_indoor" | "price_per_hour"
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

  if (!data) return { title: "Kortello" };

  const t = await getTranslations("clubPage");
  return {
    title: `${data.name} · Kortello`,
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
  ] = await Promise.all([
    supabase
      .from("courts")
      .select("id, name, sport, surface, is_indoor, price_per_hour")
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
  ]);
  const groups = (groupsData ?? []) as unknown as PublicGroup[];
  // After the club's free trial ends, online booking pauses (20261025_trial_lock.sql).
  const { data: pausedData } = await supabase.rpc("paused_clubs", { p_clubs: [club.id] });
  const paused = (pausedData ?? []).length > 0;

  const courts = (courtsData ?? []) as unknown as PublicCourt[];
  const coaches = (coachesData ?? []) as unknown as PublicCoach[];
  const plans = (plansData ?? []) as unknown as MembershipPlan[];
  const tournaments = (tournamentsData ?? []) as Pick<
    Tournament,
    "id" | "name" | "sport" | "starts_on" | "status"
  >[];
  const tTour = await getTranslations("tournaments");
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
            Kortello
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
              {courts.map((court) => (
                <div key={court.id} className="card flex flex-col p-6">
                  <div className="mb-3 text-lg font-semibold leading-snug text-ink-900">
                    {court.name}
                  </div>
                  <div className="mb-5 flex flex-wrap gap-1.5">
                    <span className="badge-brand">
                      {labels.sport(court.sport)}
                    </span>
                    <span className="badge bg-ink-50 text-ink-800">
                      {labels.surface(court.surface)}
                    </span>
                    <span className="badge-blue">
                      {labels.inOut(court.is_indoor)}
                    </span>
                  </div>
                  <div className="mt-auto border-t border-ink-100 pt-4 text-xl font-bold tracking-tight text-ink-900">
                    €{court.price_per_hour}
                    <span className="text-sm font-normal tracking-normal text-ink-600">
                      {" "}
                      {t("perHour")}
                    </span>
                  </div>
                </div>
              ))}
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
