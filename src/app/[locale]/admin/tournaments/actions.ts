"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildBracket, nextSlot, shuffle } from "@/lib/tournament";
import { SPORTS } from "@/lib/labels";

// Club side of tournaments. Every write goes through the club owner's own
// session, so the database rules (20261018_tournaments.sql) make sure an
// owner only ever touches their own club's tournaments.

type Result = { error?: string; id?: string };

export type TournamentInput = {
  name: string;
  sport: string;
  starts_on: string;
  max_entries: number;
  entry_fee: number | null;
  description: string;
};

const refresh = (id?: string) => {
  revalidatePath("/[locale]/admin/tournaments", "page");
  if (id) {
    revalidatePath("/[locale]/admin/tournaments/[id]", "page");
    revalidatePath("/[locale]/tournaments/[id]", "page");
  }
};

function clean(input: TournamentInput) {
  const name = input.name.trim();
  if (name.length < 2) return { error: "name" } as const;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.starts_on)) return { error: "date" } as const;
  const max = Math.round(Number(input.max_entries));
  if (!Number.isFinite(max) || max < 2 || max > 64) return { error: "maxEntries" } as const;
  const fee = input.entry_fee === null || Number.isNaN(input.entry_fee) ? null : Number(input.entry_fee);
  if (fee !== null && fee < 0) return { error: "fee" } as const;
  return {
    value: {
      name,
      sport: (SPORTS as string[]).includes(input.sport) ? input.sport : "tennis",
      starts_on: input.starts_on,
      max_entries: max,
      entry_fee: fee,
      description: input.description.trim() || null,
    },
  };
}

export async function createTournament(input: TournamentInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "failed" };

  const checked = clean(input);
  if ("error" in checked) return { error: checked.error };

  const { data: club } = await supabase
    .from("clubs")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!club) return { error: "failed" };

  const { data, error } = await supabase
    .from("tournaments")
    .insert({ ...checked.value, club_id: club.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[tournaments] create", error);
    return { error: "failed" };
  }
  refresh();
  return { id: data.id };
}

export async function updateTournament(id: string, input: TournamentInput): Promise<Result> {
  const checked = clean(input);
  if ("error" in checked) return { error: checked.error };
  const supabase = await createClient();
  const { error } = await supabase.from("tournaments").update(checked.value).eq("id", id);
  if (error) return { error: "failed" };
  refresh(id);
  return {};
}

export async function deleteTournament(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("tournaments").delete().eq("id", id);
  if (error) return { error: "failed" };
  refresh();
  return {};
}

/** Open or close sign-ups (only before the draw). */
export async function setSignups(id: string, open: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournaments")
    .update({ status: open ? "open" : "closed" })
    .eq("id", id)
    .in("status", ["open", "closed"]);
  if (error) return { error: "failed" };
  refresh(id);
  return {};
}

export async function addEntry(tournamentId: string, name: string): Promise<Result> {
  const clean = name.trim();
  if (!clean) return { error: "entryName" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_entries")
    .insert({ tournament_id: tournamentId, name: clean.slice(0, 120) });
  if (error) return { error: "failed" };
  refresh(tournamentId);
  return {};
}

export async function removeEntry(tournamentId: string, entryId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("tournament_entries").delete().eq("id", entryId);
  if (error) return { error: "failed" };
  refresh(tournamentId);
  return {};
}

/** Makes (or makes again) a random knockout draw from everyone signed up. */
export async function makeDraw(tournamentId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("tournament_entries")
    .select("id")
    .eq("tournament_id", tournamentId);
  const ids = (entries ?? []).map((e) => e.id);
  if (ids.length < 2) return { error: "tooFew" };

  const { error: clearError } = await supabase
    .from("tournament_matches")
    .delete()
    .eq("tournament_id", tournamentId);
  if (clearError) return { error: "failed" };

  const matches = buildBracket(shuffle(ids)).map((m) => ({ ...m, tournament_id: tournamentId }));
  const { error } = await supabase.from("tournament_matches").insert(matches);
  if (error) {
    console.error("[tournaments] draw", error);
    return { error: "failed" };
  }

  const { error: statusError } = await supabase
    .from("tournaments")
    .update({ status: "started" })
    .eq("id", tournamentId);
  if (statusError) {
    console.error("[tournaments] start", statusError);
    return { error: "failed" };
  }
  refresh(tournamentId);
  return {};
}

/** Throws the draw away and goes back to sign-ups (closed). */
export async function undoDraw(tournamentId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_matches")
    .delete()
    .eq("tournament_id", tournamentId);
  if (error) return { error: "failed" };
  const { error: statusError } = await supabase
    .from("tournaments")
    .update({ status: "closed" })
    .eq("id", tournamentId);
  if (statusError) {
    console.error("[tournaments] undo draw", statusError);
    return { error: "failed" };
  }
  refresh(tournamentId);
  return {};
}

/**
 * Saves the result of a match and moves the winner on to the next round.
 * winnerId null clears the result. A result can't change once the next
 * match has been played, so the bracket never contradicts itself.
 */
export async function setResult(
  tournamentId: string,
  matchId: string,
  winnerId: string | null,
  score: string,
): Promise<Result> {
  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("tournament_matches")
    .select("id, round, position, entry1_id, entry2_id, winner_id")
    .eq("tournament_id", tournamentId);
  const all = matches ?? [];
  const match = all.find((m) => m.id === matchId);
  if (!match) return { error: "failed" };
  if (winnerId && winnerId !== match.entry1_id && winnerId !== match.entry2_id) {
    return { error: "failed" };
  }

  const rounds = Math.max(...all.map((m) => m.round));
  const slot = nextSlot(match.round, match.position);
  const next = all.find((m) => m.round === slot.round && m.position === slot.position);
  if (next?.winner_id && winnerId !== match.winner_id) return { error: "nextPlayed" };

  const { error } = await supabase
    .from("tournament_matches")
    .update({ winner_id: winnerId, score: winnerId ? score.trim().slice(0, 60) || null : null })
    .eq("id", matchId);
  if (error) return { error: "failed" };

  if (next) {
    const { error: nextError } = await supabase
      .from("tournament_matches")
      .update(slot.slot === "entry1_id" ? { entry1_id: winnerId } : { entry2_id: winnerId })
      .eq("id", next.id);
    if (nextError) {
      console.error("[tournaments] move winner on", nextError);
      refresh(tournamentId);
      return { error: "failed" };
    }
  }

  // The final decides whether the tournament is finished.
  if (match.round === rounds) {
    const { error: statusError } = await supabase
      .from("tournaments")
      .update({ status: winnerId ? "finished" : "started" })
      .eq("id", tournamentId);
    if (statusError) {
      console.error("[tournaments] finish", statusError);
      refresh(tournamentId);
      return { error: "failed" };
    }
  }
  refresh(tournamentId);
  return {};
}
