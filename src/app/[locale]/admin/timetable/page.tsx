import { redirect } from "next/navigation";
import TimetableClient from "@/components/admin/TimetableClient";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Booking, Club, Court, Member, Profile } from "@/types/database";

type BookingWithJoins = Booking & {
  court?: Pick<Court, "id" | "name"> | null;
  member?: Pick<Member, "full_name"> | null;
  player?: Pick<Profile, "full_name"> | null;
};

type CourtRow = Pick<Court, "id" | "name" | "surface" | "is_indoor" | "sport">;

export default async function TimetablePage() {
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
        "*, court:courts(id, name), member:members(full_name), player:profiles(full_name)",
      )
      .in(
        "court_id",
        courts.map((c) => c.id),
      )
      .in("status", ["confirmed", "completed", "pending"])
      .order("starts_at");
    bookings = (bookingsData ?? []) as BookingWithJoins[];
  }

  return <TimetableClient courts={courts} bookings={bookings} />;
}
