"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { BILLING_COLUMNS, clubAccess, type ClubBilling } from "@/lib/plans";
import { SPORTS } from "@/lib/labels";
import { GROUP_LEVELS, feeFor } from "@/lib/groups";
import { toUtc } from "@/lib/automation/time";
import { emailFeeDue, emailOffers, type GroupClub } from "@/lib/email/groups";
import type { GroupBreak, GroupPlayerStatus } from "@/types/database";

// Club side of coaching groups: owner and staff. Every write goes through
// their own session, so the database rules (20261024_groups.sql) make sure
// they only ever touch their own club's groups.

type Result = {
  error?: string;
  id?: string;
  created?: number;
  cancelled?: number;
  skipped?: string[];
  sent?: number;
  offered?: number;
};

export type GroupInput = {
  name: string;
  kind: "season" | "dropin";
  sport: string;
  level: string;
  age_min: number | null;
  age_max: number | null;
  adults: boolean;
  coach_id: string | null;
  court_id: string | null;
  days: number[];
  start_time: string;
  end_time: string;
  starts_on: string;
  ends_on: string;
  breaks: GroupBreak[];
  max_players: number;
  price: number;
  member_price: number | null;
  member_plan_id: string | null;
  online_signup: boolean;
  coach_approves: boolean;
  trial: boolean;
  description: string;
};

/** Another court on a day the usual one is taken: { "2026-11-19": courtId }. */
export type CourtChoices = Record<string, string>;

export type PreviewRow = {
  day: string;
  starts_at: string;
  ends_at: string;
  existing: boolean;
  clash: "court" | "coach" | "closed" | null;
  clash_who: string | null;
  clash_starts: string | null;
  clash_ends: string | null;
  free_court_id: string | null;
  free_court_name: string | null;
};

const CLUB_COLUMNS = `id, name, country, phone, email, slug, ${BILLING_COLUMNS}`;
type MyClub = { id: string; slug: string } & GroupClub & ClubBilling;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function refresh(id?: string) {
  revalidatePath("/[locale]/admin/groups", "page");
  revalidatePath("/[locale]/admin/timetable", "page");
  revalidatePath("/[locale]/groups", "page");
  revalidatePath("/[locale]/clubs/[slug]", "page");
  if (id) {
    revalidatePath("/[locale]/admin/groups/[id]", "page");
    revalidatePath("/[locale]/groups/[id]", "page");
  }
}

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, club: null };
  const { club } = await getMyClub<MyClub>(supabase, user.id, CLUB_COLUMNS);
  return { supabase, user, club };
}

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function clean(input: GroupInput) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return { error: "name" } as const;
  const days = Array.from(new Set(input.days.map(Number))).filter((d) => d >= 1 && d <= 7).sort();
  if (days.length === 0) return { error: "days" } as const;
  if (!TIME.test(input.start_time) || !TIME.test(input.end_time)) return { error: "times" } as const;
  const length = minutes(input.end_time) - minutes(input.start_time);
  if (length < 30 || length > 240) return { error: "times" } as const;
  if (!DATE.test(input.starts_on) || !DATE.test(input.ends_on) || input.ends_on < input.starts_on) {
    return { error: "dates" } as const;
  }
  const span = (Date.parse(input.ends_on) - Date.parse(input.starts_on)) / 86_400_000;
  if (span > 400) return { error: "dates" } as const;
  if (!input.court_id) return { error: "court" } as const;
  const max = Math.round(Number(input.max_players));
  if (!Number.isFinite(max) || max < 1 || max > 60) return { error: "players" } as const;
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) return { error: "price" } as const;
  const memberPrice =
    input.member_price === null || Number.isNaN(Number(input.member_price)) ? null : Number(input.member_price);
  if (memberPrice !== null && memberPrice < 0) return { error: "price" } as const;
  const ageMin = input.age_min ? Math.round(Number(input.age_min)) : null;
  const ageMax = input.age_max ? Math.round(Number(input.age_max)) : null;
  if ((ageMin !== null && (ageMin < 3 || ageMin > 99)) || (ageMax !== null && (ageMax < 3 || ageMax > 99))) {
    return { error: "ages" } as const;
  }
  if (ageMin !== null && ageMax !== null && ageMin > ageMax) return { error: "ages" } as const;
  const breaks = (input.breaks ?? [])
    .filter((b) => DATE.test(b.from) && DATE.test(b.to || b.from))
    .map((b) => ({
      from: b.from <= (b.to || b.from) ? b.from : b.to,
      to: b.from <= (b.to || b.from) ? b.to || b.from : b.from,
      label: (b.label ?? "").trim().slice(0, 60) || undefined,
    }))
    .slice(0, 20);

  return {
    value: {
      name,
      kind: input.kind === "dropin" ? "dropin" : "season",
      sport: (SPORTS as string[]).includes(input.sport) ? input.sport : "tennis",
      level: (GROUP_LEVELS as string[]).includes(input.level) ? input.level : "all",
      age_min: input.adults ? null : ageMin,
      age_max: input.adults ? null : ageMax,
      adults: !!input.adults,
      coach_id: input.coach_id || null,
      court_id: input.court_id,
      days,
      start_time: input.start_time,
      end_time: input.end_time,
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      breaks,
      max_players: max,
      price: Math.round(price * 100) / 100,
      member_price: input.kind === "dropin" ? null : memberPrice,
      member_plan_id: input.kind === "dropin" || memberPrice === null ? null : input.member_plan_id || null,
      online_signup: !!input.online_signup,
      coach_approves: input.kind === "dropin" ? false : !!input.coach_approves,
      trial: input.kind === "dropin" ? false : !!input.trial,
      description: input.description.trim().slice(0, 1000) || null,
    },
  };
}

/** The season's sessions from today, and what is in the way of each. */
export async function previewSessions(
  input: GroupInput,
  groupId?: string,
): Promise<{ rows?: PreviewRow[]; error?: string }> {
  const checked = clean({ ...input, name: input.name.trim() || "Group" });
  if ("error" in checked) return { error: checked.error };
  const { supabase, club } = await session();
  if (!club) return { error: "failed" };
  const v = checked.value;
  const { data, error } = await supabase.rpc("preview_group_sessions", {
    p_club: club.id,
    p_court: v.court_id,
    p_coach: v.coach_id,
    p_days: v.days,
    p_start_time: v.start_time,
    p_end_time: v.end_time,
    p_starts_on: v.starts_on,
    p_ends_on: v.ends_on,
    p_breaks: v.breaks,
    p_group: groupId ?? null,
  });
  if (error) {
    console.error("[groups] preview", error);
    return { error: "failed" };
  }
  return { rows: (data ?? []) as PreviewRow[] };
}

async function sync(supabase: Awaited<ReturnType<typeof createClient>>, id: string, choices: CourtChoices) {
  const { data, error } = await supabase.rpc("sync_group_sessions", { p_group: id, p_choices: choices });
  if (error) {
    console.error("[groups] sync", error);
    return null;
  }
  return data as { created: number; cancelled: number; skipped: string[] };
}

export async function createGroup(input: GroupInput, choices: CourtChoices): Promise<Result> {
  const checked = clean(input);
  if ("error" in checked) return { error: checked.error };
  const { supabase, club } = await session();
  if (!club) return { error: "failed" };
  if (!clubAccess(club).has("groups")) return { error: "plan" };

  const { data, error } = await supabase
    .from("groups")
    .insert({ ...checked.value, club_id: club.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[groups] create", error);
    return { error: "failed" };
  }
  const result = await sync(supabase, data.id, choices);
  refresh(data.id);
  return { id: data.id, ...(result ?? { error: "sessions" }) };
}

export async function updateGroup(id: string, input: GroupInput, choices: CourtChoices): Promise<Result> {
  const checked = clean(input);
  if ("error" in checked) return { error: checked.error };
  const { supabase, club } = await session();
  if (!club) return { error: "failed" };
  // The kind is set when the group is made.
  const { kind: _kind, ...value } = checked.value;
  void _kind;
  const { error } = await supabase.from("groups").update(value).eq("id", id).eq("club_id", club.id);
  if (error) {
    console.error("[groups] update", error);
    return { error: "failed" };
  }
  const result = await sync(supabase, id, choices);
  refresh(id);
  return { id, ...(result ?? { error: "sessions" }) };
}

/** Ends the group: the sessions still to come are cancelled, the history stays. */
export async function archiveGroup(id: string, archived: boolean): Promise<Result> {
  const { supabase, club } = await session();
  if (!club) return { error: "failed" };
  const { error } = await supabase
    .from("groups")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("club_id", club.id);
  if (error) return { error: "failed" };
  const result = await sync(supabase, id, {});
  refresh(id);
  return result ?? {};
}

export async function deleteGroup(id: string): Promise<Result> {
  const { supabase, club } = await session();
  if (!club) return { error: "failed" };
  const { error } = await supabase.from("groups").delete().eq("id", id).eq("club_id", club.id);
  if (error) return { error: "failed" };
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export type PlayerInput = {
  name: string;
  age: number | null;
  contact_name: string;
  email: string;
  phone: string;
  monthly_price: number | null;
  notes: string;
};

function cleanPlayer(input: PlayerInput) {
  const name = input.name.trim();
  if (!name || name.length > 80) return { error: "playerName" } as const;
  const email = input.email.trim().toLowerCase();
  if (email && (!EMAIL.test(email) || email.length > 200)) return { error: "email" } as const;
  const age = input.age ? Math.round(Number(input.age)) : null;
  if (age !== null && (age < 3 || age > 99)) return { error: "age" } as const;
  const price =
    input.monthly_price === null || Number.isNaN(Number(input.monthly_price)) ? null : Number(input.monthly_price);
  if (price !== null && price < 0) return { error: "price" } as const;
  return {
    value: {
      name,
      age,
      contact_name: input.contact_name.trim().slice(0, 80) || null,
      email: email || null,
      phone: input.phone.trim().slice(0, 40) || null,
      monthly_price: price,
      notes: input.notes.trim().slice(0, 500) || null,
    },
  };
}

/** Adds someone to the list, or to the waiting list when the group is full. */
export async function addPlayer(groupId: string, input: PlayerInput, waiting = false): Promise<Result> {
  const checked = cleanPlayer(input);
  if ("error" in checked) return { error: checked.error };
  const { supabase, club } = await session();
  if (!club) return { error: "failed" };
  const { data, error } = await supabase
    .from("group_players")
    .insert({ ...checked.value, group_id: groupId, status: waiting ? "waiting" : "active", source: "club" })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[groups] add player", error);
    return { error: "failed" };
  }
  refresh(groupId);
  return { id: data.id };
}

export async function updatePlayer(groupId: string, playerId: string, input: PlayerInput): Promise<Result> {
  const checked = cleanPlayer(input);
  if ("error" in checked) return { error: checked.error };
  const { supabase } = await session();
  const { error } = await supabase.from("group_players").update(checked.value).eq("id", playerId);
  if (error) return { error: "failed" };
  refresh(groupId);
  return {};
}

/** Offers free places to the waiting list and emails the offers. */
async function fillPlaces(
  supabase: Awaited<ReturnType<typeof createClient>>,
  club: MyClub,
  groupId: string,
  playerId?: string,
) {
  const [{ data: offers, error }, { data: group }] = await Promise.all([
    supabase.rpc("offer_group_places", { p_group: groupId, p_player: playerId ?? null }),
    supabase.from("groups").select("name, days, start_time, end_time").eq("id", groupId).maybeSingle(),
  ]);
  if (error) {
    console.error("[groups] offer", error);
    return { offered: 0, sent: 0 };
  }
  if (!group || !offers?.length) return { offered: 0, sent: 0 };
  return { offered: offers.length, sent: await emailOffers(club, group, offers) };
}

/**
 * Moves someone on the list: accept a request or keep a trial player
 * (active), put on the waiting list, or take off the list (left). A place
 * that opens goes to the waiting list straight away.
 */
export async function setPlayerStatus(
  groupId: string,
  playerId: string,
  status: Extract<GroupPlayerStatus, "active" | "waiting" | "left">,
): Promise<Result> {
  const { supabase, club } = await session();
  if (!club) return { error: "failed" };
  const { error } = await supabase
    .from("group_players")
    .update({
      status,
      ...(status === "active" ? { joined_on: new Date().toISOString().slice(0, 10), trial_session_id: null } : {}),
      ...(status === "waiting" ? { waiting_since: new Date().toISOString() } : {}),
    })
    .eq("id", playerId)
    .eq("group_id", groupId);
  if (error) {
    console.error("[groups] status", error);
    return { error: "failed" };
  }
  const result = status === "left" ? await fillPlaces(supabase, club, groupId) : {};
  refresh(groupId);
  return result;
}

/** Offers a place to one person on the waiting list, even if the group is full. */
export async function offerPlace(groupId: string, playerId: string): Promise<Result> {
  const { supabase, club } = await session();
  if (!club) return { error: "failed" };
  const result = await fillPlaces(supabase, club, groupId, playerId);
  refresh(groupId);
  return result;
}

/** Emails everyone on the list who hasn't paid for this month. */
export async function remindUnpaid(groupId: string, month: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-01$/.test(month)) return { error: "failed" };
  const { supabase, club } = await session();
  if (!club) return { error: "failed" };
  const [{ data: group }, { data: players }, { data: fees }] = await Promise.all([
    supabase.from("groups").select("name, price").eq("id", groupId).maybeSingle(),
    supabase
      .from("group_players")
      .select("id, name, contact_name, email, monthly_price")
      .eq("group_id", groupId)
      .eq("status", "active"),
    supabase.from("group_fees").select("player_id").eq("month", month),
  ]);
  if (!group) return { error: "failed" };
  const paid = new Set((fees ?? []).map((f) => f.player_id));
  let sent = 0;
  for (const p of players ?? []) {
    if (paid.has(p.id) || !p.email) continue;
    if (await emailFeeDue(club, group.name, month, { ...p, amount: feeFor(p, group) })) sent++;
  }
  return { sent };
}

export async function moveSession(
  groupId: string,
  sessionId: string,
  day: string,
  start: string,
  end: string,
  courtId: string,
): Promise<Result> {
  if (!DATE.test(day) || !TIME.test(start) || !TIME.test(end)) return { error: "times" };
  const { supabase } = await session();
  // The club's local time, whatever the server's time zone.
  const startsAt = toUtc(day, start);
  const endsAt = toUtc(day, end);
  const { error } = await supabase.rpc("move_group_session", {
    p_session: sessionId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_court: courtId,
  });
  if (error) {
    if (error.message.includes("busy")) return { error: "busy" };
    if (error.message.includes("passed")) return { error: "past" };
    if (error.message.includes("times")) return { error: "times" };
    console.error("[groups] move", error);
    return { error: "failed" };
  }
  refresh(groupId);
  return {};
}

