"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { emailSessionCancelled } from "@/lib/email/groups";
import type { AttendanceStatus, FeeMethod } from "@/types/database";

// Coaching groups, the parts the coach and the players use. The database
// functions in 20261024_groups.sql check who may do what.

type Result = { error?: string; status?: string; sent?: number };

function refresh() {
  revalidatePath("/[locale]/admin/groups", "page");
  revalidatePath("/[locale]/admin/groups/[id]", "page");
  revalidatePath("/[locale]/admin/groups/[id]/register/[sessionId]", "page");
  revalidatePath("/[locale]/admin/timetable", "page");
  revalidatePath("/[locale]/groups", "page");
  revalidatePath("/[locale]/groups/[id]", "page");
  revalidatePath("/[locale]/groups/[id]/register/[sessionId]", "page");
  revalidatePath("/[locale]/clubs/[slug]", "page");
}

/** Maps a database error to a short key the screens translate. */
function errorKey(message: string | undefined) {
  const m = message ?? "";
  if (m.includes("sign in")) return "notSignedIn";
  if (m.includes("confirm your email")) return "confirmEmail";
  if (m.includes("Already") || m.includes("already have")) return "already";
  if (m.includes("ages")) return "age";
  if (m.includes("full")) return "full";
  if (m.includes("run out")) return "expired";
  if (m.includes("no longer open")) return "closed";
  if (m.includes("not open") || m.includes("does not take")) return "closed";
  if (m.includes("already started")) return "started";
  if (m.includes("booked since")) return "taken";
  if (m.includes("Not allowed")) return "notAllowed";
  return "failed";
}

// ---------------------------------------------------------------------------
// Coach and club
// ---------------------------------------------------------------------------

export type RegisterRow =
  | { player_id: string; status: AttendanceStatus | null }
  | { attendance_id: string; status?: AttendanceStatus; paid?: boolean; remove?: boolean }
  | { guest_name: string; status: AttendanceStatus; paid?: boolean };

export async function saveRegister(sessionId: string, rows: RegisterRow[], note: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_group_register", {
    p_session: sessionId,
    p_rows: rows,
    p_note: note.trim().slice(0, 1000) || null,
  });
  if (error) {
    console.error("[groups] register", error);
    return { error: errorKey(error.message) };
  }
  refresh();
  return {};
}

/** Cancels one session, frees the court and emails the parents. */
export async function cancelSession(sessionId: string, reason: string): Promise<Result> {
  const supabase = await createClient();
  const clean = reason.trim().slice(0, 200) || null;
  const { data: session } = await supabase
    .from("group_sessions")
    .select("starts_at, ends_at, group:groups(name, club:clubs(name, country, phone, email))")
    .eq("id", sessionId)
    .maybeSingle();
  const { data: contacts, error } = await supabase.rpc("cancel_group_session", {
    p_session: sessionId,
    p_reason: clean,
  });
  if (error) {
    console.error("[groups] cancel", error);
    return { error: errorKey(error.message) };
  }

  let sent = 0;
  const row = session as unknown as {
    starts_at: string;
    ends_at: string;
    group: { name: string; club: { name: string; country: string | null; phone: string | null; email: string | null } | null } | null;
  } | null;
  if (row?.group?.club && contacts?.length && new Date(row.starts_at) > new Date()) {
    sent = await emailSessionCancelled(row.group.club, row.group, row, clean, contacts);
  }
  refresh();
  return { sent };
}

export async function restoreSession(sessionId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_group_session", { p_session: sessionId });
  if (error) return { error: errorKey(error.message) };
  refresh();
  return {};
}

/** Marks a month paid (club or coach). */
export async function markFee(
  playerId: string,
  month: string,
  amount: number,
  method: FeeMethod,
): Promise<Result> {
  if (!/^\d{4}-\d{2}-01$/.test(month) || !(amount >= 0)) return { error: "failed" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("group_fees").upsert(
    {
      player_id: playerId,
      month,
      amount: Math.round(amount * 100) / 100,
      method: (["cash", "bank", "other"] as const).includes(method) ? method : "cash",
      paid_at: new Date().toISOString(),
      marked_by: user?.id ?? null,
    },
    { onConflict: "player_id,month" },
  );
  if (error) {
    console.error("[groups] fee", error);
    return { error: "failed" };
  }
  refresh();
  return {};
}

export async function unmarkFee(playerId: string, month: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("group_fees").delete().eq("player_id", playerId).eq("month", month);
  if (error) return { error: "failed" };
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Parents and players
// ---------------------------------------------------------------------------

export async function joinGroup(
  groupId: string,
  input: { name: string; age: number | null; phone: string; forSelf: boolean; trial: boolean },
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notSignedIn" };
  const name = input.name.trim();
  if (!name) return { error: "name" };
  const { data, error } = await supabase.rpc("join_group", {
    p_group: groupId,
    p_name: name.slice(0, 80),
    p_age: input.age && input.age > 0 ? Math.round(input.age) : null,
    p_phone: input.phone.trim().slice(0, 40) || null,
    p_for_self: input.forSelf,
    p_trial: input.trial,
  });
  if (error) {
    if (errorKey(error.message) === "failed") console.error("[groups] join", error);
    return { error: errorKey(error.message) };
  }
  refresh();
  return { status: (data as { status: string }).status };
}

export async function leaveGroup(playerId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", { p_player: playerId });
  if (error) return { error: errorKey(error.message) };
  refresh();
  return {};
}

/** "Leo can't come" — or, undone, "Leo can come after all". */
export async function setAbsence(sessionId: string, playerId: string, absent: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_group_absence", {
    p_session: sessionId,
    p_player: playerId,
    p_absent: absent,
  });
  if (error) return { error: errorKey(error.message) };
  refresh();
  return {};
}

export async function bookSession(sessionId: string, name: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notSignedIn" };
  const { error } = await supabase.rpc("book_group_session", {
    p_session: sessionId,
    p_name: name.trim().slice(0, 80) || null,
  });
  if (error) {
    if (errorKey(error.message) === "failed") console.error("[groups] book", error);
    return { error: errorKey(error.message) };
  }
  refresh();
  return {};
}

export async function unbookSession(sessionId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unbook_group_session", { p_session: sessionId });
  if (error) return { error: errorKey(error.message) };
  refresh();
  return {};
}

/** Yes or no to a place offered from the waiting list (works without an account). */
export async function respondOffer(token: string, accept: boolean): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "closed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_group_offer", { p_token: token, p_accept: accept });
  if (error) return { error: errorKey(error.message) };
  refresh();
  return { status: data as string };
}
