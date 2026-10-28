import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Sport } from "@/types/database";
import type { LevelChange, MyLevel } from "@/lib/openMatches";

/**
 * The signed-in player's levels, one per sport they set, with club names
 * and the latest changes their results made (20261030c_levels_from_results.sql).
 */
export async function loadMyLevels(supabase: SupabaseClient<Database>, userId: string): Promise<MyLevel[]> {
  const { data } = await supabase
    .from("player_levels")
    .select("sport, level, rating, rated_matches, confirmed_at, confirmed_by_club, check_club")
    .eq("profile_id", userId);
  const rows = data ?? [];
  const changes = await loadChanges(supabase, userId);
  const clubIds = [
    ...new Set(rows.flatMap((r) => [r.confirmed_by_club, r.check_club]).filter((v): v is string => !!v)),
  ];
  const { data: clubs } = clubIds.length
    ? await supabase.from("clubs").select("id, name").in("id", clubIds)
    : { data: [] as { id: string; name: string }[] };
  const nameOf = (id: string | null) => (id ? (clubs ?? []).find((c) => c.id === id)?.name ?? null : null);
  return rows.map((r) => ({
    sport: r.sport as Sport,
    level: Number(r.level),
    confirmed_at: r.confirmed_at,
    confirmed_club: r.confirmed_at ? nameOf(r.confirmed_by_club) : null,
    check_club: r.check_club,
    check_club_name: nameOf(r.check_club),
    rating: Number(r.rating ?? r.level),
    rated_matches: r.rated_matches ?? 0,
    changes: changes.filter((c) => c.sport === r.sport).slice(0, 5),
  }));
}

/** The latest level changes, with the league or evening each came from. */
async function loadChanges(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<(LevelChange & { sport: string })[]> {
  const { data } = await supabase
    .from("level_changes")
    .select("sport, source, parent_id, delta, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = data ?? [];
  const parents = (source: string) => [
    ...new Set(rows.filter((r) => r.source === source && r.parent_id).map((r) => r.parent_id!)),
  ];
  const [leagueIds, eventIds] = [parents("league"), parents("americano")];
  const [{ data: leagues }, { data: events }] = await Promise.all([
    leagueIds.length
      ? supabase.from("leagues").select("id, name").in("id", leagueIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    eventIds.length
      ? supabase.from("social_events").select("id, name").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const names = new Map([...(leagues ?? []), ...(events ?? [])].map((x) => [x.id, x.name]));
  return rows.map((r) => ({
    sport: r.sport,
    delta: Number(r.delta),
    at: r.created_at,
    source: r.source === "league" ? "league" : "americano",
    name: r.parent_id ? (names.get(r.parent_id) ?? null) : null,
  }));
}
