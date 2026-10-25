import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Sport } from "@/types/database";
import type { MyLevel } from "@/lib/openMatches";

/** The signed-in player's levels, one per sport they set, with club names. */
export async function loadMyLevels(supabase: SupabaseClient<Database>, userId: string): Promise<MyLevel[]> {
  const { data } = await supabase
    .from("player_levels")
    .select("sport, level, confirmed_at, confirmed_by_club, check_club")
    .eq("profile_id", userId);
  const rows = data ?? [];
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
  }));
}
