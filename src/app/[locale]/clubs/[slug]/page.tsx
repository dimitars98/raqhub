import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

// The public page of one club: what a visitor sees before they have an account.
// Everything read here is allowed for logged-out visitors by the database
// rules (active clubs, active courts, active coaches with name and photo,
// plans). Booking itself always happens after signing in.

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

const AVATAR_COLORS = [
  "bg-brand-100 text-brand-900",
  "bg-court-100 text-court-800",
  "bg-accent-100 text-accent-800",
  "bg-ink-100 text-ink-800",
];

const initials = (name: string | null) =>
  (name ?? "C")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// The same coach always gets the same color.
const avatarColorFor = (id: string) => {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

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

  if (!data) return { title: "ServeTime" };

  const t = await getTranslations("clubPage");
  return {
    title: `${data.name} · ServeTime`,
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
    {
      data: { user },
    },
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
    supabase.auth.getUser(),
  ]);

  const courts = (courtsData ?? []) as unknown as PublicCourt[];
  const coaches = (coachesData ?? []) as unknown as PublicCoach[];
  const plans = (plansData ?? []) as unknown as MembershipPlan[];

  // Who is looking decides which button they get.
  let viewer: Viewer = "visitor";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    viewer = role === "club_admin" || role === "super_admin" ? "admin" : "player";
  }

  const action =
    viewer === "admin"
      ? { href: "/admin/timetable", label: t("backToDashboard") }
      : viewer === "player"
        ? { href: `/book?club=${club.slug}`, label: t("bookCourt") }
        : { href: "/signup?role=player", label: t("signUpToBook") };

  const website = safeWebsite(club.website);
  const location = [club.address, club.city].filter(Boolean).join(", ");

  const SPORT: Record<string, string> = {
    tennis: t("sports.tennis"),
    padel: t("sports.padel"),
    pickleball: t("sports.pickleball"),
  };
  const SURFACE: Record<string, string> = {
    clay: t("surfaces.clay"),
    hard: t("surfaces.hard"),
    grass: t("surfaces.grass"),
    artificial_grass: t("surfaces.artificial_grass"),
    carpet: t("surfaces.carpet"),
    concrete: t("surfaces.concrete"),
    acrylic: t("surfaces.acrylic"),
  };
  const LEVEL: Record<string, string> = {
    beginner: t("levels.beginner"),
    intermediate: t("levels.intermediate"),
    advanced: t("levels.advanced"),
    junior: t("levels.junior"),
    adult: t("levels.adult"),
  };
  const BILLING: Record<string, string> = {
    monthly: t("billing.monthly"),
    annual: t("billing.annual"),
    one_time: t("billing.one_time"),
  };

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
            ServeTime
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher size="sm" />
            {viewer === "visitor" && (
              <Link href="/login" className="btn-ghost whitespace-nowrap">
                {t("signIn")}
              </Link>
            )}
            {/* On phones the same button is at the bottom of the page. */}
            <Link
              href={action.href}
              className="btn-primary hidden whitespace-nowrap sm:inline-flex"
            >
              {action.label}
            </Link>
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
                      {SPORT[court.sport] ?? court.sport}
                    </span>
                    <span className="badge bg-ink-50 text-ink-800">
                      {SURFACE[court.surface] ?? court.surface}
                    </span>
                    <span className="badge-blue">
                      {court.is_indoor ? t("indoor") : t("outdoor")}
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
                    {coach.profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coach.profile.avatar_url}
                        alt=""
                        className="size-14 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className={`flex size-14 shrink-0 items-center justify-center rounded-full text-base font-semibold ${avatarColorFor(coach.id)}`}
                      >
                        {initials(coach.profile?.full_name ?? null)}
                      </div>
                    )}
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
                          {LEVEL[level] ?? level}
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
                      {BILLING[plan.billing_period] ?? plan.billing_period}
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
          {viewer === "visitor" && (
            <p className="mx-auto mb-6 max-w-xl text-sm text-ink-200">
              {t("ctaText")}
            </p>
          )}
          <Link
            href={action.href}
            className={`inline-flex items-center rounded-full bg-brand-400 px-6 py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-brand-200 ${viewer === "visitor" ? "" : "mt-4"}`}
          >
            {action.label}
          </Link>
        </section>
      </main>
    </>
  );
}
