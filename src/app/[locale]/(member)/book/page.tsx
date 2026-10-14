import { createClient } from "@/lib/supabase/server";
import type { Court } from "@/types/database";
import { Suspense } from "react";
import Spinner from "@/components/ui/Spinner";
import BookCourtsClient from "@/components/member/BookCourtsClient";

type CourtWithClub = Court & {
  club?: {
    name: string;
    city: string | null;
    slug: string;
    opening_hours: unknown;
    booking_rules: unknown;
  } | null;
};

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
        ? "*, club:clubs!inner(name, city, slug, opening_hours, booking_rules)"
        : "*, club:clubs(name, city, slug, opening_hours, booking_rules)",
    )
    .eq("is_active", true)
    .order("price_per_hour");
  if (clubSlug) query = query.eq("club.slug", clubSlug);

  const { data } = await query;
  const courts = (data ?? []) as unknown as CourtWithClub[];
  const clubName = clubSlug ? courts[0]?.club?.name : undefined;

  return (
    <Suspense fallback={<Spinner />}>
      <BookCourtsClient courts={courts} clubName={clubName} />
    </Suspense>
  );
}
