import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TournamentsClient, { type TournamentRow } from "@/components/admin/TournamentsClient";

export default async function AdminTournamentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: club } = await supabase
    .from("clubs")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!club) redirect("/admin/setup");

  const { data } = await supabase
    .from("tournaments")
    .select("*, entries:tournament_entries(count)")
    .eq("club_id", club.id)
    .order("starts_on", { ascending: false });

  const tournaments = ((data ?? []) as unknown as (TournamentRow & {
    entries: { count: number }[];
  })[]).map(({ entries, ...t }) => ({ ...t, entryCount: entries?.[0]?.count ?? 0 }));

  return <TournamentsClient tournaments={tournaments} />;
}
