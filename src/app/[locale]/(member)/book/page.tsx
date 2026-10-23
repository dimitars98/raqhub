import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import Spinner from "@/components/ui/Spinner";
import BookCourtsClient, { type CourtWithClub } from "@/components/member/BookCourtsClient";
import BookingPaused from "@/components/ui/BookingPaused";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const { club: clubSlug } = await searchParams;
  const supabase = await createClient();

  // ?club=<slug> comes from a club's public page: show only that club.
  let query = supabase
    .from("courts")
    .select(
      clubSlug
        ? "*, club:clubs!inner(name, city, slug, phone, email, opening_hours, booking_rules)"
        : "*, club:clubs(name, city, slug, phone, email, opening_hours, booking_rules)",
    )
    .eq("is_active", true)
    .order("price_per_hour");
  if (clubSlug) query = query.eq("club.slug", clubSlug);

  const { data } = await query;
  const all = (data ?? []) as unknown as (CourtWithClub & {
    club: { phone?: string | null; email?: string | null } | null;
  })[];

  // Clubs whose free trial has ended don't take online bookings.
  const clubIds = [...new Set(all.map((c) => c.club_id).filter(Boolean))] as string[];
  const { data: pausedIds } = clubIds.length
    ? await supabase.rpc("paused_clubs", { p_clubs: clubIds })
    : { data: [] as string[] };
  const paused = new Set((pausedIds ?? []) as string[]);
  const courts = all.filter((c) => !c.club_id || !paused.has(c.club_id));
  const clubName = clubSlug ? all[0]?.club?.name : undefined;

  if (clubSlug && all.length > 0 && courts.length === 0) {
    const club = all[0].club;
    return (
      <div className="mx-auto max-w-2xl py-6">
        <BookingPaused clubName={club?.name} phone={club?.phone} email={club?.email} />
      </div>
    );
  }

  return (
    <Suspense fallback={<Spinner />}>
      <BookCourtsClient courts={courts} clubName={clubName} />
    </Suspense>
  );
}
