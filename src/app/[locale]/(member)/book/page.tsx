import { createClient } from "@/lib/supabase/server";
import type { Court } from "@/types/database";
import { Suspense } from "react";
import Spinner from "@/components/ui/Spinner";
import BookCourtsClient from "@/components/member/BookCourtsClient";

type CourtWithClub = Court & {
  club?: { name: string; city: string | null } | null;
};

export default async function BookPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("courts")
    .select("*, club:clubs(name, city)")
    .eq("is_active", true)
    .order("price_per_hour");

  const courts = (data ?? []) as CourtWithClub[];

  return (
    <Suspense fallback={<Spinner />}>
      <BookCourtsClient courts={courts} />
    </Suspense>
  );
}
