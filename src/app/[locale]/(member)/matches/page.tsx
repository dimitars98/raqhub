import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MatchesClient from "@/components/matches/MatchesClient";
import { loadMyLevels } from "@/lib/myLevels";
import { MATCH_SPORTS, type MatchCard } from "@/lib/openMatches";
import type { Sport } from "@/types/database";

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string; sport?: string }>;
}) {
  const { club: clubSlug, sport } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ?club=<slug> comes from a club's public page: only that club's matches.
  const { data: club } = clubSlug
    ? await supabase.from("clubs").select("id, name, slug").eq("slug", clubSlug).maybeSingle()
    : { data: null };

  const [{ data: feed }, levels] = await Promise.all([
    supabase.rpc("open_match_feed", { p_club: club?.id ?? null, p_sport: null }),
    loadMyLevels(supabase, user.id),
  ]);

  return (
    <MatchesClient
      matches={(feed ?? []) as unknown as MatchCard[]}
      levels={levels}
      club={club ?? null}
      initialSport={MATCH_SPORTS.includes(sport as Sport) ? (sport as Sport) : null}
    />
  );
}
