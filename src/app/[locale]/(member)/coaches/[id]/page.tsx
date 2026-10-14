import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeHours } from "@/lib/openingHours";
import { normalizeRules } from "@/lib/bookingRules";
import CoachBookingForm from "@/components/member/CoachBookingForm";
import type { Coach, Club, Profile } from "@/types/database";

type CoachWithJoins = Pick<
  Coach,
  "id" | "bio" | "levels" | "specializations" | "price_per_hour" | "club_id"
> & {
  profile: Pick<Profile, "full_name" | "avatar_url"> | null;
  club: Pick<Club, "name" | "city" | "opening_hours" | "booking_rules"> | null;
};

const initials = (name: string | null) =>
  (name ?? "C")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default async function CoachPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const t = await getTranslations("coachBooking");
  const tLevel = await getTranslations("adminCoaches");

  const { data } = await supabase
    .from("coaches")
    .select(
      "id, bio, levels, specializations, price_per_hour, club_id, profile:profiles(full_name, avatar_url), club:clubs(name, city, opening_hours, booking_rules)",
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  const coach = data as unknown as CoachWithJoins | null;
  if (!coach) notFound();

  const name = coach.profile?.full_name ?? t("coach");
  const levels = coach.levels ?? [];
  const specializations = coach.specializations ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/coaches"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        {t("allCoaches")}
      </Link>

      {/* Coach card */}
      <div className="card mb-5 flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
        {coach.profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coach.profile.avatar_url}
            alt=""
            className="size-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-900"
          >
            {initials(coach.profile?.full_name ?? null)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            {name}
          </h1>
          {coach.club && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
              <MapPin size={14} className="text-ink-400" aria-hidden="true" />
              {coach.club.name}
              {coach.club.city ? ` · ${coach.club.city}` : ""}
            </p>
          )}
          {coach.bio && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">
              {coach.bio}
            </p>
          )}
          {(levels.length > 0 || specializations.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {levels.map((level) => (
                <span key={level} className="badge-brand">
                  {tLevel.has(level) ? tLevel(level) : level}
                </span>
              ))}
              {specializations.map((s) => (
                <span key={s} className="badge bg-ink-50 text-ink-800">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 text-xl font-bold tracking-tight text-ink-900">
          €{coach.price_per_hour}
          <span className="text-sm font-normal tracking-normal text-ink-600">
            {" "}
            {t("perHour")}
          </span>
        </div>
      </div>

      <CoachBookingForm
        coachId={coach.id}
        coachName={name}
        clubId={coach.club_id}
        pricePerHour={coach.price_per_hour}
        hours={normalizeHours(coach.club?.opening_hours)}
        rules={normalizeRules(coach.club?.booking_rules)}
      />
    </div>
  );
}
