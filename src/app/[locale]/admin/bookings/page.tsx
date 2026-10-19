import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMyClub } from "@/lib/myClub";
import { createClient } from "@/lib/supabase/server";
import type { Club, Court, Member } from "@/types/database";
import BookingsClient from "@/components/admin/BookingsClient";
import Spinner from "@/components/ui/Spinner";
import { noShowCutoff, normalizeRules } from "@/lib/bookingRules";
import type { BookingWithJoins, NoShow } from "@/components/admin/BookingsClient";

type CourtRow = Pick<Court, "id" | "name" | "price_per_hour" | "is_active">;

export default async function AdminBookingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The club the signed-in admin owns, or is staff of
  const { club } = await getMyClub<Pick<Club, "id" | "booking_rules">>(
    supabase,
    user.id,
    "id, booking_rules",
  );
  if (!club) redirect("/admin/setup");

  // All of the club's courts, so bookings on a deactivated court still show
  const { data: courtsData } = await supabase
    .from("courts")
    .select("id, name, price_per_hour, is_active")
    .eq("club_id", club.id)
    .order("name");
  const allCourts = (courtsData ?? []) as CourtRow[];
  const courtIds = allCourts.map((c) => c.id);

  // Lessons with the club's coaches have no court, so they are found by coach.
  const { data: coachData } = await supabase
    .from("coaches")
    .select("id")
    .eq("club_id", club.id);
  const coachIds = (coachData ?? []).map((c) => c.id);

  const filters = [
    courtIds.length ? `court_id.in.(${courtIds.join(",")})` : null,
    coachIds.length ? `coach_id.in.(${coachIds.join(",")})` : null,
  ].filter(Boolean);

  const since = noShowCutoff().toISOString();

  const [bookingsResult, membersResult, noShowsResult] = await Promise.all([
    filters.length > 0
      ? supabase
          .from("bookings")
          .select(
            "*, court:courts(name), member:members(full_name), player:profiles(full_name), coach:coaches(profile:profiles(full_name))",
          )
          .or(filters.join(","))
          .order("starts_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    supabase
      .from("members")
      .select("id, full_name")
      .eq("club_id", club.id)
      .eq("status", "active")
      .order("full_name"),
    // No-shows of the last 90 days, to count them per player.
    filters.length > 0
      ? supabase
          .from("bookings")
          .select("id, player_id, member_id")
          .or(filters.join(","))
          .eq("status", "no_show")
          .gte("starts_at", since)
      : Promise.resolve({ data: [] }),
  ]);

  const bookings = (bookingsResult.data ?? []) as BookingWithJoins[];
  const members = (membersResult.data ?? []) as Pick<
    Member,
    "id" | "full_name"
  >[];
  // Only active courts can be picked for a new booking
  const courts = allCourts.filter((c) => c.is_active);

  return (
    <Suspense fallback={<Spinner />}>
      <BookingsClient
        bookings={bookings}
        courts={courts}
        members={members}
        noShows={(noShowsResult.data ?? []) as NoShow[]}
        maxNoShows={normalizeRules(club.booking_rules).max_no_shows}
      />
    </Suspense>
  );
}
