import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Booking, Club, Profile, Court, Member } from "@/types/database";
import BookingsClient from "@/components/admin/BookingsClient";
import Spinner from "@/components/ui/Spinner";

type BookingWithJoins = Booking & {
  court?: Pick<Court, "name"> | null;
  member?: Pick<Member, "full_name"> | null;
  player?: (Pick<Profile, "full_name"> & { email?: string | null }) | null;
};

type CourtRow = Pick<Court, "id" | "name" | "price_per_hour" | "is_active">;

export default async function AdminBookingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The club owned by the signed-in admin
  const { data: clubData } = await supabase
    .from("clubs")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  const club = clubData as Pick<Club, "id"> | null;
  if (!club) redirect("/admin/setup");

  // All of the club's courts, so bookings on a deactivated court still show
  const { data: courtsData } = await supabase
    .from("courts")
    .select("id, name, price_per_hour, is_active")
    .eq("club_id", club.id)
    .order("name");
  const allCourts = (courtsData ?? []) as CourtRow[];
  const courtIds = allCourts.map((c) => c.id);

  const [bookingsResult, membersResult] = await Promise.all([
    courtIds.length > 0
      ? supabase
          .from("bookings")
          .select(
            "*, court:courts(name), member:members(full_name), player:profiles(full_name)",
          )
          .in("court_id", courtIds)
          .order("starts_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    supabase
      .from("members")
      .select("id, full_name")
      .eq("club_id", club.id)
      .eq("status", "active")
      .order("full_name"),
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
      <BookingsClient bookings={bookings} courts={courts} members={members} />
    </Suspense>
  );
}
