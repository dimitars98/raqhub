import { redirect } from "next/navigation";
import TimetableClient, {
  type BookingWithJoins,
  type CourtRow,
} from "@/components/admin/TimetableClient";
import { createClient } from "@/lib/supabase/server";
import type { Club } from "@/types/database";
import { getMyClub } from "@/lib/myClub";
import { CLOSURE_COLUMNS, type Closure } from "@/lib/closures";

/** A week ago, so closures from the last few days still show. */
const weekAgo = () => new Date(Date.now() - 7 * 86_400_000).toISOString();

export default async function TimetablePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The club the signed-in admin owns, or is staff of
  const { club } = await getMyClub<Pick<Club, "id">>(supabase, user.id, "id");

  if (!club) redirect("/admin/setup");

  const { data: courtsData } = await supabase
    .from("courts")
    .select("id, name, surface, is_indoor, sport")
    .eq("club_id", club.id)
    .eq("is_active", true)
    .order("name");
  const courts = (courtsData ?? []) as CourtRow[];

  // Only bookings on this club's courts
  let bookings: BookingWithJoins[] = [];
  if (courts.length > 0) {
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select(
        "*, court:courts(id, name), member:members(full_name), player:profiles(full_name), coach:coaches(profile:profiles(full_name))",
      )
      .in(
        "court_id",
        courts.map((c) => c.id),
      )
      .in("status", ["confirmed", "completed", "pending"])
      .order("starts_at");
    bookings = (bookingsData ?? []) as BookingWithJoins[];
  }

  // Closed courts, from a week back (20261027_court_closures.sql).
  const { data: closuresData } = await supabase
    .from("court_closures")
    .select(CLOSURE_COLUMNS)
    .eq("club_id", club.id)
    .gt("ends_at", weekAgo())
    .order("starts_at");
  const closures = (closuresData ?? []) as Closure[];

  return <TimetableClient courts={courts} bookings={bookings} closures={closures} />;
}
