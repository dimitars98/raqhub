"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { leagueError, type LeagueResult } from "@/lib/leagueErrors";
import type { SetScore } from "@/lib/leagues";

// Player side of leagues (the club uses saveLeagueScore too). The database
// checks who may do what (20261028_leagues.sql).

const refresh = () => {
  revalidatePath("/[locale]/leagues/[id]", "page");
  revalidatePath("/[locale]/admin/leagues/[id]", "page");
  revalidatePath("/[locale]/leagues", "page");
};

export async function signUpForLeague(leagueId: string, name: string, partner: string): Promise<LeagueResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("league_sign_up", {
    p_league: leagueId,
    p_name: name.trim().slice(0, 120),
    p_partner: partner.trim().slice(0, 120),
  });
  if (error) return { error: leagueError(error, "[leagues] sign up") };
  refresh();
  return {};
}

export async function withdrawFromLeague(leagueId: string): Promise<LeagueResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("league_withdraw", { p_league: leagueId });
  if (error) return { error: leagueError(error, "[leagues] withdraw") };
  refresh();
  return {};
}

/**
 * A match's score, from entry 1's side. `walkover`: the entry that didn't
 * turn up. Both null clears the score (the club only).
 */
export async function saveLeagueScore(
  matchId: string,
  sets: SetScore[] | null,
  walkover: string | null,
): Promise<LeagueResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("league_save_score", {
    p_match: matchId,
    p_sets: sets,
    p_walkover: walkover,
  });
  if (error) return { error: leagueError(error, "[leagues] score") };
  refresh();
  return {};
}
