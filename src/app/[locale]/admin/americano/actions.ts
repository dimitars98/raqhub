"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { SPORTS } from "@/lib/labels";
import { americanoRound, mexicanoRound, type SocialView } from "@/lib/americano";
import { socialError, type SocialResult } from "@/lib/americanoErrors";

// Club side of Americano evenings. Every write goes through the admin's own
// session, so the database rules (20261030_americano.sql) keep each club to
// its own evenings.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SocialInput = {
  name: string;
  sport: string;
  format: "americano" | "mexicano";
  starts_at: string;
  ends_at: string;
  court_ids: string[];
  points_per_match: number;
  max_players: number;
  entry_fee: number | null;
  level_min: number | null;
  level_max: number | null;
  description: string;
};

const refresh = () => {
  revalidatePath("/[locale]/admin/americano", "page");
  revalidatePath("/[locale]/admin/americano/[id]", "page");
  revalidatePath("/[locale]/americano/[id]", "page");
};

function clean(input: SocialInput) {
  const name = input.name.trim();
  if (name.length < 2) return { error: "name" } as const;
  const start = new Date(input.starts_at);
  const end = new Date(input.ends_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { error: "date" } as const;
  if (end <= start) return { error: "times" } as const;
  if (!input.court_ids.length) return { error: "courts" } as const;
  const max = Math.round(Number(input.max_players));
  if (!Number.isInteger(max) || max < 4 || max > 64) return { error: "maxPlayers" } as const;
  const points = Math.round(Number(input.points_per_match));
  if (!Number.isInteger(points) || points < 8 || points > 64) return { error: "points" } as const;
  const fee = input.entry_fee === null || Number.isNaN(input.entry_fee) ? null : Number(input.entry_fee);
  if (fee !== null && fee < 0) return { error: "fee" } as const;
  if (input.level_min !== null && input.level_max !== null && input.level_min > input.level_max)
    return { error: "levels" } as const;
  return {
    value: {
      name,
      sport: (SPORTS as string[]).includes(input.sport) ? input.sport : "padel",
      format: input.format === "mexicano" ? "mexicano" : "americano",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      court_ids: [...new Set(input.court_ids)],
      points_per_match: points,
      max_players: max,
      entry_fee: fee,
      level_min: input.level_min,
      level_max: input.level_max,
      description: input.description.trim() || null,
    },
  };
}

/**
 * Holds the evening's courts with a booking each, so nobody else books
 * them. Bookings it held before are let go first. All or nothing.
 */
async function holdCourts(
  supabase: Supabase,
  ev: { id: string; name: string; starts_at: string; ends_at: string; court_ids: string[]; booking_ids: string[] },
): Promise<SocialResult> {
  if (ev.booking_ids.length) {
    await supabase.from("bookings").update({ status: "cancelled" }).in("id", ev.booking_ids);
  }
  if (new Date(ev.ends_at) <= new Date()) {
    await supabase.from("social_events").update({ booking_ids: [] }).eq("id", ev.id);
    return {};
  }
  const minutes = Math.round((new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime()) / 60_000);
  const made: string[] = [];
  for (const court of ev.court_ids) {
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        court_id: court,
        starts_at: ev.starts_at,
        ends_at: ev.ends_at,
        duration_min: minutes,
        total_price: 0,
        status: "confirmed",
        walk_in_name: ev.name.slice(0, 120),
        notes: "Americano",
      })
      .select("id")
      .single();
    if (error || !data) {
      // One court is taken: give back the ones just held, keep nothing.
      if (made.length) await supabase.from("bookings").update({ status: "cancelled" }).in("id", made);
      await supabase.from("social_events").update({ booking_ids: [] }).eq("id", ev.id);
      return { error: socialError(error, "[americano] hold court") };
    }
    made.push(data.id);
  }
  await supabase.from("social_events").update({ booking_ids: made }).eq("id", ev.id);
  return {};
}

export async function createSocial(input: SocialInput): Promise<SocialResult & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "failed" };
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club) return { error: "failed" };
  const checked = clean(input);
  if ("error" in checked) return { error: checked.error };

  const { data, error } = await supabase
    .from("social_events")
    .insert({ ...checked.value, club_id: club.id })
    .select("id, name, starts_at, ends_at, court_ids, booking_ids")
    .single();
  if (error || !data) return { error: socialError(error, "[americano] create") };

  const held = await holdCourts(supabase, data);
  refresh();
  // The evening exists either way; a court that was taken is reported.
  return { id: data.id, error: held.error };
}

export async function updateSocial(id: string, input: SocialInput): Promise<SocialResult> {
  const supabase = await createClient();
  const checked = clean(input);
  if ("error" in checked) return { error: checked.error };
  const { data: before } = await supabase
    .from("social_events")
    .select("starts_at, ends_at, court_ids, status")
    .eq("id", id)
    .maybeSingle();
  if (!before) return { error: "failed" };
  // The format can't change once rounds are being played.
  const value = before.status === "open" ? checked.value : { ...checked.value, format: undefined, sport: undefined };
  const { data, error } = await supabase
    .from("social_events")
    .update(value)
    .eq("id", id)
    .select("id, name, starts_at, ends_at, court_ids, booking_ids")
    .single();
  if (error || !data) return { error: socialError(error, "[americano] update") };

  const moved =
    before.starts_at !== data.starts_at ||
    before.ends_at !== data.ends_at ||
    before.court_ids.join() !== data.court_ids.join();
  const held = moved ? await holdCourts(supabase, data) : {};
  refresh();
  return held;
}

export async function deleteSocial(id: string): Promise<SocialResult> {
  const supabase = await createClient();
  const { data } = await supabase.from("social_events").select("booking_ids").eq("id", id).maybeSingle();
  if (data?.booking_ids?.length) {
    await supabase.from("bookings").update({ status: "cancelled" }).in("id", data.booking_ids);
  }
  const { error } = await supabase.from("social_events").delete().eq("id", id);
  if (error) return { error: socialError(error, "[americano] delete") };
  revalidatePath("/[locale]/admin/americano", "page");
  return {};
}

export async function addSocialPlayer(eventId: string, name: string, level: number | null): Promise<SocialResult> {
  if (!name.trim()) return { error: "entryName" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("social_players")
    .insert({ event_id: eventId, name: name.trim().slice(0, 120), level });
  if (error) return { error: socialError(error, "[americano] add player") };
  refresh();
  return {};
}

/** Before round 1: take a player out. Later: mark them withdrawn (games played still count). */
export async function removeSocialPlayer(playerId: string, started: boolean): Promise<SocialResult> {
  const supabase = await createClient();
  const { error } = started
    ? await supabase.from("social_players").update({ status: "withdrawn" }).eq("id", playerId)
    : await supabase.from("social_players").delete().eq("id", playerId);
  if (error) return { error: socialError(error, "[americano] remove player") };
  refresh();
  return {};
}

/** Makes the next round from the players still in and the courts of the evening. */
export async function nextSocialRound(eventId: string): Promise<SocialResult> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("social_view", { p_event: eventId });
  const view = data as unknown as SocialView | null;
  if (!view?.manages) return { error: "failed" };
  if (view.event.status === "finished") return { error: "finished" };

  const active = view.players.filter((p) => p.status === "active").map((p) => p.id);
  const courts = view.courts.length;
  if (active.length < 4 || courts < 1) return { error: "tooFew" };

  const round = Math.max(0, ...view.matches.map((m) => m.round)) + 1;
  const next =
    view.event.format === "mexicano"
      ? mexicanoRound(view, active, courts)
      : americanoRound(active, courts, view.matches, view.byes);

  const { error } = await supabase.from("social_matches").insert(
    next.games.map((g, i) => ({
      event_id: eventId,
      round,
      court_index: i,
      a1: g[0],
      a2: g[1],
      b1: g[2],
      b2: g[3],
    })),
  );
  if (error) return { error: socialError(error, "[americano] round") };
  if (next.byes.length) {
    const { error: byeError } = await supabase
      .from("social_byes")
      .insert(next.byes.map((player) => ({ event_id: eventId, round, player })));
    if (byeError) console.error("[americano] byes", byeError);
  }
  if (view.event.status === "open") {
    await supabase.from("social_events").update({ status: "running" }).eq("id", eventId);
  }
  refresh();
  return {};
}

/** Takes back the last round, if none of its games has a score yet. */
export async function undoSocialRound(eventId: string): Promise<SocialResult> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("social_matches")
    .select("round, score_a")
    .eq("event_id", eventId)
    .order("round", { ascending: false });
  const round = last?.[0]?.round;
  if (!round) return { error: "failed" };
  if (last!.some((m) => m.round === round && m.score_a !== null)) return { error: "hasScores" };
  await supabase.from("social_matches").delete().eq("event_id", eventId).eq("round", round);
  await supabase.from("social_byes").delete().eq("event_id", eventId).eq("round", round);
  if (round === 1) await supabase.from("social_events").update({ status: "open" }).eq("id", eventId);
  refresh();
  return {};
}

export async function finishSocial(eventId: string, finished = true): Promise<SocialResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("social_events")
    .update({ status: finished ? "finished" : "running" })
    .eq("id", eventId);
  if (error) return { error: socialError(error, "[americano] finish") };
  refresh();
  return {};
}
