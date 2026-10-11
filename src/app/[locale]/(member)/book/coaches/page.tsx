import { createClient } from "@/lib/supabase/server";
import type { Coach } from "@/types/database";
import { Suspense } from "react";
import Spinner from "@/components/ui/Spinner";
import BookCoachesClient from "@/components/member/BookCoachesClient";

type CoachWithProfile = Coach & {
  profile?: { full_name: string | null } | null;
  club?: { name: string; city: string | null } | null;
};

export default async function BookCoachesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("coaches")
    .select("*, profile:profiles(full_name), club:clubs(name, city)")
    .eq("is_active", true)
    .order("price_per_hour");

  const coaches = (data ?? []) as CoachWithProfile[];

  return (
    <Suspense fallback={<Spinner />}>
      <BookCoachesClient coaches={coaches} />
    </Suspense>
  );
}
