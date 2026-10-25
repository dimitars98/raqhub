import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LevelClient from "@/components/matches/LevelClient";
import { loadMyLevels } from "@/lib/myLevels";
import { getSafeRedirect } from "@/lib/safeRedirect";
import { MATCH_SPORTS, type MatchClub } from "@/lib/openMatches";
import type { Sport } from "@/types/database";

export default async function LevelPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; next?: string }>;
}) {
  const { sport, next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [levels, { data: clubs }] = await Promise.all([
    loadMyLevels(supabase, user.id),
    supabase.rpc("open_match_clubs"),
  ]);

  return (
    <LevelClient
      levels={levels}
      clubs={(clubs ?? []) as unknown as MatchClub[]}
      initialSport={MATCH_SPORTS.includes(sport as Sport) ? (sport as Sport) : "padel"}
      // Only paths inside the app, without the language (the app adds it).
      next={getSafeRedirect(next ?? null)?.replace(/^\/(mk|sq|en|de|fr|it|sr)(?=\/)/, "") ?? null}
    />
  );
}
