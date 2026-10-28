import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import SocialsClient, { type SocialRow } from "@/components/admin/SocialsClient";
import type { ClubCourt } from "@/components/americano/SocialForm";

export default async function AdminAmericanoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club) redirect("/admin/setup");

  const [{ data, error }, { data: courts }] = await Promise.all([
    supabase
      .from("social_events")
      .select("*, players:social_players(count)")
      .eq("club_id", club.id)
      .eq("players.status", "active")
      .order("starts_at", { ascending: false }),
    supabase.from("courts").select("id, name, sport").eq("club_id", club.id).eq("is_active", true).order("name"),
  ]);
  if (error) console.error("[admin americano]", error);

  const events = ((data ?? []) as unknown as (SocialRow & { players: { count: number }[] })[]).map(
    ({ players, ...e }) => ({ ...e, playerCount: players?.[0]?.count ?? 0 }),
  );
  return <SocialsClient events={events} courts={(courts ?? []) as ClubCourt[]} />;
}
