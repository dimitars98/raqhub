"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { SPORTS } from "@/lib/labels";
import { leagueError, type LeagueResult } from "@/lib/leagueErrors";

// Club side of leagues. Every write goes through the admin's own session, so
// the database rules (20261028_leagues.sql) keep each club to its own leagues.

export type LeagueInput = {
  name: string;
  sport: string;
  team_size: number;
  box_size: number;
  round_weeks: number;
  move_count: number;
  starts_on: string;
  max_entries: number;
  entry_fee: number | null;
  level_min: number | null;
  level_max: number | null;
  description: string;
};

const refresh = () => {
  revalidatePath("/[locale]/admin/leagues", "page");
  revalidatePath("/[locale]/admin/leagues/[id]", "page");
  revalidatePath("/[locale]/leagues/[id]", "page");
};

const inList = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

function clean(input: LeagueInput, started: boolean) {
  const name = input.name.trim();
  if (name.length < 2) return { error: "name" } as const;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.starts_on)) return { error: "date" } as const;
  const max = Math.round(Number(input.max_entries));
  if (!inList(max, 4, 96)) return { error: "maxEntries" } as const;
  const fee = input.entry_fee === null || Number.isNaN(input.entry_fee) ? null : Number(input.entry_fee);
  if (fee !== null && fee < 0) return { error: "fee" } as const;
  const lo = input.level_min;
  const hi = input.level_max;
  if (lo !== null && hi !== null && lo > hi) return { error: "levels" } as const;
  if (!inList(input.box_size, 3, 6) || !inList(input.round_weeks, 1, 8) || !inList(input.move_count, 0, 2))
    return { error: "failed" } as const;
  const value = {
    name,
    starts_on: input.starts_on,
    box_size: input.box_size,
    round_weeks: input.round_weeks,
    move_count: input.move_count,
    max_entries: max,
    entry_fee: fee,
    level_min: lo,
    level_max: hi,
    description: input.description.trim() || null,
  };
  // Sport and singles/pairs can't change once boxes are made.
  return {
    value: started
      ? value
      : {
          ...value,
          sport: (SPORTS as string[]).includes(input.sport) ? input.sport : "padel",
          team_size: input.team_size === 1 ? 1 : 2,
        },
  };
}

export async function createLeague(input: LeagueInput): Promise<LeagueResult & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "failed" };
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club) return { error: "failed" };

  const checked = clean(input, false);
  if ("error" in checked) return { error: checked.error };

  const { data, error } = await supabase
    .from("leagues")
    .insert({ ...checked.value, club_id: club.id })
    .select("id")
    .single();
  if (error || !data) return { error: leagueError(error, "[leagues] create") };
  refresh();
  return { id: data.id };
}

export async function updateLeague(id: string, input: LeagueInput, started: boolean): Promise<LeagueResult> {
  const supabase = await createClient();
  const checked = clean(input, started);
  if ("error" in checked) return { error: checked.error };
  const { error } = await supabase.from("leagues").update(checked.value).eq("id", id);
  if (error) return { error: leagueError(error, "[leagues] update") };
  refresh();
  return {};
}

export async function deleteLeague(id: string): Promise<LeagueResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("leagues").delete().eq("id", id);
  if (error) return { error: leagueError(error, "[leagues] delete") };
  revalidatePath("/[locale]/admin/leagues", "page");
  return {};
}

/** A player or pair the club adds (signed up at the desk, no account, …). */
export async function addLeagueEntry(
  leagueId: string,
  name: string,
  partner: string,
  level: number | null,
): Promise<LeagueResult> {
  const supabase = await createClient();
  if (!name.trim()) return { error: "entryName" };
  // Last in the seeding; the club can move them up.
  const { data: last } = await supabase
    .from("league_entries")
    .select("seed")
    .eq("league_id", leagueId)
    .order("seed", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("league_entries").insert({
    league_id: leagueId,
    name: name.trim().slice(0, 120),
    partner_name: partner.trim().slice(0, 120) || null,
    level,
    seed: (last?.seed ?? 0) + 1,
  });
  if (error) return { error: leagueError(error, "[leagues] add entry") };
  refresh();
  return {};
}

/** Before the first round: take an entry out. Later: mark it withdrawn. */
export async function removeLeagueEntry(entryId: string, started: boolean): Promise<LeagueResult> {
  const supabase = await createClient();
  const { error } = started
    ? await supabase.from("league_entries").update({ status: "withdrawn" }).eq("id", entryId)
    : await supabase.from("league_entries").delete().eq("id", entryId);
  if (error) return { error: leagueError(error, "[leagues] remove entry") };
  refresh();
  return {};
}

/** Saves the seeding: the entries in their new order, strongest first. */
export async function saveSeeding(leagueId: string, entryIds: string[]): Promise<LeagueResult> {
  const supabase = await createClient();
  const results = await Promise.all(
    entryIds.map((id, i) =>
      supabase.from("league_entries").update({ seed: i + 1 }).eq("id", id).eq("league_id", leagueId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: leagueError(failed.error, "[leagues] seeding") };
  refresh();
  return {};
}

export async function nextRound(leagueId: string): Promise<LeagueResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("league_next_round", { p_league: leagueId });
  if (error) return { error: leagueError(error, "[leagues] next round") };
  refresh();
  return {};
}

export async function undoRound(leagueId: string): Promise<LeagueResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("league_undo_round", { p_league: leagueId });
  if (error) return { error: leagueError(error, "[leagues] undo round") };
  refresh();
  return {};
}

export async function finishLeague(leagueId: string): Promise<LeagueResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("league_finish", { p_league: leagueId });
  if (error) return { error: leagueError(error, "[leagues] finish") };
  refresh();
  return {};
}
