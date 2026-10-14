import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { Booking, Court, Member, Profile } from "@/types/database";

type CourtWithClub = Court & {
  club?: { name: string; city: string | null } | null;
};

type BookingWithPlayer = Booking & {
  player?: Pick<Profile, "full_name"> | null;
  member?: Pick<Member, "full_name"> | null;
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-brand-100 text-brand-800",
  pending: "bg-accent-100 text-accent-800",
  cancelled: "bg-ink-100 text-ink-600",
  completed: "bg-court-100 text-court-800",
  no_show: "bg-red-100 text-red-700",
};
const STATUSES = Object.keys(STATUS_STYLES);
const SURFACE_KEY: Record<string, string> = {
  clay: "clay",
  hard: "hard",
  grass: "grass",
  artificial_grass: "artificialGrass",
  carpet: "carpet",
  concrete: "concrete",
  acrylic: "acrylic",
};

export default async function AdminCourtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getTranslations("courtDetail");
  const tCourts = await getTranslations("adminCourts");
  const tStatus = await getTranslations("adminBookings.statusLabels");
  const locale = await getLocale();
  const fmt = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { timeZone: "Europe/Skopje", ...options }).format(
      new Date(value),
    );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single()) as { data: { role: string } | null; error: unknown };

  if (profile?.role !== "club_admin" && profile?.role !== "super_admin") {
    redirect("/");
  }

  const { data: courtData } = await supabase
    .from("courts")
    .select("*, club:clubs!inner(name, city, owner_id)")
    .eq("id", id)
    // Only courts of the signed-in owner's own club
    .eq("club.owner_id", user?.id ?? "")
    .single();

  const court = courtData as CourtWithClub | null;
  if (!court) notFound();

  const { data: bookingsData } = await supabase
    .from("bookings")
    .select("*, player:profiles(full_name), member:members(full_name)")
    .eq("court_id", id)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(20);

  const bookings = (bookingsData ?? []) as BookingWithPlayer[];

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 text-sm text-ink-400 mb-6">
        <Link
          href="/admin/courts"
          className="hover:text-ink-600 transition-colors"
        >
          {t("courts")}
        </Link>
        <span>/</span>
        <span className="text-ink-700">{court.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-ink-900">{court.name}</h1>
          <p className="text-sm text-ink-400 mt-1">
            {court.club?.name}
            {court.club?.city ? ` · ${court.club.city}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            court.is_active
              ? "bg-brand-100 text-brand-800"
              : "bg-ink-100 text-ink-600"
          }`}
        >
          {court.is_active ? tCourts("active") : tCourts("inactive")}
        </span>
      </div>

      <div className="card p-5 mb-8">
        <h2 className="text-sm font-medium text-ink-900 mb-4">{t("details")}</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-ink-400 text-xs">{tCourts("surface")}</dt>
            <dd className="text-ink-900 mt-0.5">
              {SURFACE_KEY[court.surface] ? tCourts(SURFACE_KEY[court.surface] as "clay") : court.surface}
            </dd>
          </div>
          <div>
            <dt className="text-ink-400 text-xs">{tCourts("type")}</dt>
            <dd className="text-ink-900 mt-0.5">
              {court.is_indoor ? tCourts("indoor") : tCourts("outdoor")}
            </dd>
          </div>
          <div>
            <dt className="text-ink-400 text-xs">{tCourts("pricePerHour")}</dt>
            <dd className="text-ink-900 mt-0.5">
              €{court.price_per_hour}
            </dd>
          </div>
          {court.description && (
            <div className="col-span-2">
              <dt className="text-ink-400 text-xs">{tCourts("description")}</dt>
              <dd className="text-ink-900 mt-0.5">{court.description}</dd>
            </div>
          )}
        </dl>
      </div>

      <h2 className="text-sm font-medium text-ink-900 mb-4">
        {t("upcoming")}
      </h2>
      {!bookings.length ? (
        <p className="text-sm text-ink-400">{t("noUpcoming")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((b) => {
            const name =
              b.member?.full_name ??
              b.player?.full_name ??
              b.walk_in_name ??
              t("unknown");
            return (
              <div
                key={b.id}
                className="card px-4 py-3 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900">{name}</div>
                  <div className="text-xs text-ink-400 mt-0.5">
                    {fmt(b.starts_at, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    – {fmt(b.ends_at, { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="text-sm font-medium text-ink-800">
                  €{b.total_price}
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[b.status] ?? "bg-brand-100 text-brand-800"}`}
                >
                  {STATUSES.includes(b.status) ? tStatus(b.status as "confirmed") : b.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
