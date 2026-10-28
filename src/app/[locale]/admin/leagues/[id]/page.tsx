import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { requestOrigin } from "@/lib/requestOrigin";
import LeagueClient from "@/components/admin/LeagueClient";
import type { LeagueView } from "@/lib/leagues";

export default async function AdminLeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale, origin] = await Promise.all([params, getLocale(), requestOrigin()]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club) redirect("/admin/setup");

  const { data, error } = await supabase.rpc("league_view", { p_league: id });
  if (error) console.error("[admin league]", error);
  const view = data as unknown as LeagueView | null;
  if (!view || view.league.club_id !== club.id) notFound();

  return <LeagueClient view={view} publicUrl={`${origin}/${locale}/leagues/${id}`} />;
}
