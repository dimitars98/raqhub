import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import LeaguesClient, { type LeagueRow } from "@/components/admin/LeaguesClient";

export default async function AdminLeaguesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club) redirect("/admin/setup");

  const { data, error } = await supabase
    .from("leagues")
    .select("*, entries:league_entries(count)")
    .eq("club_id", club.id)
    .eq("entries.status", "active")
    .order("starts_on", { ascending: false });
  if (error) console.error("[admin leagues]", error);

  const leagues = ((data ?? []) as unknown as (LeagueRow & { entries: { count: number }[] })[]).map(
    ({ entries, ...l }) => ({ ...l, entryCount: entries?.[0]?.count ?? 0 }),
  );
  return <LeaguesClient leagues={leagues} />;
}
