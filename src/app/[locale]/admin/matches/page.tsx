import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminMatchesClient from "@/components/matches/AdminMatchesClient";
import { normalizeMatchSettings, type ClubMatchesView } from "@/lib/openMatches";

export default async function AdminMatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: club } = await supabase
    .from("clubs")
    .select("id, slug")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!club) redirect("/admin/setup");

  const { data, error } = await supabase.rpc("club_open_matches", { p_club: club.id });
  if (error) console.error("[admin matches]", error);
  const view = (data ?? { settings: null, upcoming: [], stats: null, checks: [] }) as unknown as ClubMatchesView;

  return (
    <AdminMatchesClient
      settings={normalizeMatchSettings(view.settings)}
      upcoming={view.upcoming ?? []}
      stats={view.stats ?? { opened: 0, filled: 0, released: 0, players: 0 }}
      checks={view.checks ?? []}
      clubSlug={club.slug}
    />
  );
}
