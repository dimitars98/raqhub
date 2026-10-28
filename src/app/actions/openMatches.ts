"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertCourtBooking, sendConfirmation } from "@/lib/courtBooking";
import { checkoutOrRelease } from "@/lib/payments";
import {
  LEVEL_MAX,
  LEVEL_MIN,
  MATCH_SPORTS,
  RELEASE_HOUR_CHOICES,
  matchErrorKey,
  type MatchSettings,
} from "@/lib/openMatches";
import type { Sport } from "@/types/database";

// Open matches: what players and clubs do. The database functions in
// 20261026_open_matches.sql check who may do what; errors come back as keys
// the screens translate ("matches.errors.<key>").

type Result = { error?: string; message?: string };

function refresh(matchId?: string) {
  revalidatePath("/[locale]/matches", "page");
  if (matchId) revalidatePath(`/[locale]/matches/${matchId}`, "page");
  revalidatePath("/[locale]/matches/[id]", "page");
  revalidatePath("/[locale]/my-bookings", "page");
  revalidatePath("/[locale]/admin/matches", "page");
  revalidatePath("/[locale]/clubs/[slug]", "page");
}

const validLevel = (n: number) => Number.isFinite(n) && n >= LEVEL_MIN && n <= LEVEL_MAX && Number.isInteger(n * 2);

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Starting a match
// ---------------------------------------------------------------------------

export type NewMatchInput = {
  court_id: string;
  starts_at: string;
  duration_min: number;
  level_min: number;
  level_max: number;
  competitive: boolean;
  max_players: number;
  note: string;
};

/**
 * Books the court for the organiser, then opens the booking as a match.
 * Returns the match id, an error key, or (for a booking problem) the
 * booking screens' own message in the player's language.
 */
export async function createOpenMatch(
  input: NewMatchInput,
): Promise<Result & { id?: string; checkoutUrl?: string }> {
  const { supabase, user } = await signedIn();
  if (!user) return { error: "notSignedIn" };
  if (!validLevel(input.level_min) || !validLevel(input.level_max) || input.level_min > input.level_max) {
    return { error: "levels" };
  }
  if (input.max_players !== 2 && input.max_players !== 4) return { error: "failed" };

  const booking = await insertCourtBooking(supabase, user.id, {
    court_id: input.court_id,
    starts_at: input.starts_at,
    duration_min: input.duration_min,
  });
  if (booking.error !== undefined) return { error: "booking", message: booking.error };

  const { data: matchId, error } = await supabase.rpc("create_open_match", {
    p_booking: booking.id,
    p_level_min: input.level_min,
    p_level_max: input.level_max,
    p_competitive: input.competitive,
    p_max_players: input.max_players,
    p_note: input.note.trim().slice(0, 300) || null,
  });

  if (error || !matchId) {
    console.error("[openMatches] create", error);
    // The court was booked only for the match: take the booking away again.
    try {
      await createAdminClient().from("bookings").delete().eq("id", booking.id).eq("player_id", user.id);
    } catch (e) {
      console.error("[openMatches] undo booking", e);
      await supabase.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    }
    return { error: matchErrorKey(error?.message) };
  }

  refresh(matchId);
  // The club takes payment online: the organiser pays for the court first.
  if (booking.pending) {
    const pay = await checkoutOrRelease(booking.id, user.email ?? null, `/matches/${matchId}`);
    if (pay.error) return { error: "booking", message: pay.error };
    return { id: matchId, checkoutUrl: pay.checkoutUrl };
  }
  await sendConfirmation(supabase, user, booking.id);
  return { id: matchId };
}

// ---------------------------------------------------------------------------
// Joining, leaving, the organiser's choices
// ---------------------------------------------------------------------------

export async function joinMatch(matchId: string, team: number | null): Promise<Result & { status?: string }> {
  const { supabase, user } = await signedIn();
  if (!user) return { error: "notSignedIn" };
  const { data, error } = await supabase.rpc("join_open_match", { p_match: matchId, p_team: team });
  if (error) return { error: matchErrorKey(error.message) };
  refresh(matchId);
  return { status: data ?? "in" };
}

export async function leaveMatch(matchId: string): Promise<Result> {
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("leave_open_match", { p_match: matchId });
  if (error) return { error: matchErrorKey(error.message) };
  refresh(matchId);
  return {};
}

export async function answerRequest(matchId: string, profileId: string, accept: boolean): Promise<Result> {
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("answer_match_request", {
    p_match: matchId,
    p_profile: profileId,
    p_accept: accept,
  });
  if (error) return { error: matchErrorKey(error.message) };
  refresh(matchId);
  return {};
}

export async function removePlayer(matchId: string, profileId: string): Promise<Result> {
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("remove_match_player", { p_match: matchId, p_profile: profileId });
  if (error) return { error: matchErrorKey(error.message) };
  refresh(matchId);
  return {};
}

export async function keepCourt(matchId: string, keep: boolean): Promise<Result> {
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("keep_match_court", { p_match: matchId, p_keep: keep });
  if (error) return { error: matchErrorKey(error.message) };
  refresh(matchId);
  return {};
}

/**
 * The organiser cancels the court. That's an ordinary cancellation of their
 * booking (with the club's cancel deadline); the database then calls the
 * match off and tells the others.
 */
export async function cancelMatch(matchId: string): Promise<Result> {
  const { supabase, user } = await signedIn();
  if (!user) return { error: "notSignedIn" };
  const { data } = await supabase.rpc("open_match_detail", { p_match: matchId });
  const match = data as { organiser?: boolean; booking_id?: string | null } | null;
  if (!match?.organiser || !match.booking_id) return { error: "notAllowed" };
  const booking = { id: match.booking_id };

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id)
    .eq("player_id", user.id);
  if (error) {
    const m = error.message ?? "";
    const hours = m.match(/up to (\d+) hours/);
    if (hours) return { error: "cancelDeadline", message: hours[1] };
    return { error: matchErrorKey(m) };
  }
  refresh(matchId);
  return {};
}

export async function postMessage(matchId: string, body: string): Promise<Result> {
  const text = body.trim();
  if (!text) return {};
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("post_match_message", { p_match: matchId, p_body: text.slice(0, 500) });
  if (error) return { error: matchErrorKey(error.message) };
  revalidatePath(`/[locale]/matches/${matchId}`, "page");
  return {};
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export async function setLevel(sport: Sport, level: number): Promise<Result> {
  if (!MATCH_SPORTS.includes(sport) || !validLevel(level)) return { error: "levels" };
  const { supabase, user } = await signedIn();
  if (!user) return { error: "notSignedIn" };
  const { error } = await supabase.rpc("set_my_level", { p_sport: sport, p_level: level });
  if (error) return { error: matchErrorKey(error.message) };
  refresh();
  revalidatePath("/[locale]/matches/level", "page");
  return {};
}

export async function requestLevelCheck(sport: Sport, clubId: string): Promise<Result> {
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("request_level_check", { p_sport: sport, p_club: clubId });
  if (error) return { error: matchErrorKey(error.message) };
  revalidatePath("/[locale]/matches/level", "page");
  return {};
}

// ---------------------------------------------------------------------------
// The club
// ---------------------------------------------------------------------------

export async function confirmLevel(profileId: string, sport: Sport, level: number): Promise<Result> {
  if (!validLevel(level)) return { error: "levels" };
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("confirm_player_level", {
    p_profile: profileId,
    p_sport: sport,
    p_level: level,
  });
  if (error) return { error: matchErrorKey(error.message) };
  revalidatePath("/[locale]/admin/matches", "page");
  return {};
}

export async function dismissLevelCheck(profileId: string, sport: Sport): Promise<Result> {
  const { supabase } = await signedIn();
  const { error } = await supabase.rpc("dismiss_level_check", { p_profile: profileId, p_sport: sport });
  if (error) return { error: matchErrorKey(error.message) };
  revalidatePath("/[locale]/admin/matches", "page");
  return {};
}

export async function saveMatchSettings(settings: MatchSettings): Promise<Result> {
  const { supabase, user } = await signedIn();
  if (!user) return { error: "notSignedIn" };
  const clean: MatchSettings = {
    enabled: !!settings.enabled,
    sports: MATCH_SPORTS.filter((s) => settings.sports.includes(s)),
    release_hours: (RELEASE_HOUR_CHOICES as readonly number[]).includes(settings.release_hours)
      ? settings.release_hours
      : 6,
    members_only: !!settings.members_only,
  };
  if (clean.enabled && clean.sports.length === 0) return { error: "noSports" };

  const { data, error } = await supabase
    .from("clubs")
    .update({ open_matches: clean })
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("[openMatches] settings", error);
    return { error: error?.message?.includes("club_locked") ? "readOnly" : "failed" };
  }
  refresh();
  return {};
}
