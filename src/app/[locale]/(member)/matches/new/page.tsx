import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewMatchClient, { type NewMatchCourt, type NewMatchClubInfo } from "@/components/matches/NewMatchClient";
import { loadMyLevels } from "@/lib/myLevels";
import { MATCH_SPORTS, type MatchClub } from "@/lib/openMatches";
import type { Sport } from "@/types/database";

export default async function NewMatchPage({
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

  // Clubs that take open matches, with the sports each one allows.
  const { data: clubData } = await supabase.rpc("open_match_clubs");
  const clubs = (clubData ?? []) as unknown as MatchClub[];
  const clubIds = clubs.map((c) => c.id);

  const [{ data: courtRows }, { data: infoRows }, levels] = await Promise.all([
    clubIds.length
      ? supabase
          .from("courts")
          .select("id, name, sport, club_id, price_per_hour, is_indoor")
          .in("club_id", clubIds)
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: [] }),
    clubIds.length
      ? supabase.from("clubs").select("id, opening_hours, booking_rules").in("id", clubIds)
      : Promise.resolve({ data: [] }),
    loadMyLevels(supabase, user.id),
  ]);

  const courts = ((courtRows ?? []) as unknown as NewMatchCourt[]).filter((c) =>
    clubs.find((club) => club.id === c.club_id)?.sports.includes(c.sport),
  );
  const info = (infoRows ?? []) as unknown as NewMatchClubInfo[];

  return (
    <NewMatchClient
      clubs={clubs.filter((c) => courts.some((k) => k.club_id === c.id))}
      courts={courts}
      info={info}
      levels={levels}
      initialClub={clubs.find((c) => c.slug === clubSlug)?.id ?? null}
      initialSport={MATCH_SPORTS.includes(sport as Sport) ? (sport as Sport) : null}
    />
  );
}
