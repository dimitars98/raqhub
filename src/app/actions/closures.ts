"use server";

import { revalidatePath } from "next/cache";
import { createTranslator } from "next-intl";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { sendEmail } from "@/lib/email/send";
import { courtClosedEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/email/bookings";
import { localeForCountry, pickLocale, type Locale } from "@/lib/email/locale";
import { emailSessionCancelled } from "@/lib/email/groups";
import { isReason, type ClosureReason } from "@/lib/closures";
import en from "@/messages/en.json";
import mk from "@/messages/mk.json";
import sq from "@/messages/sq.json";
import de from "@/messages/de.json";
import fr from "@/messages/fr.json";
import it from "@/messages/it.json";
import sr from "@/messages/sr.json";
import { settleRefunds } from "@/lib/payments";

// Closing courts (supabase/migrations/20261027_court_closures.sql). The
// database cancels the bookings in that time and notifies the players; this
// file sends the emails. The owner and staff can do it.

const MESSAGES = { en, mk, sq, de, fr, it, sr } as const;

export type ClosureInput = {
  /** Null: every court of the club. */
  courtIds: string[] | null;
  startsAt: string;
  endsAt: string;
  reason: ClosureReason;
  note: string;
};

export type ClosureError = "notAllowed" | "locked" | "order" | "passed" | "tooLong" | "noCourts" | "failed";

type Club = { id: string; name: string; country: string | null; phone: string | null; email: string | null };

function refresh() {
  revalidatePath("/[locale]/admin/timetable", "page");
  revalidatePath("/[locale]/admin/courts", "page");
  revalidatePath("/[locale]/admin/bookings", "page");
  revalidatePath("/[locale]/clubs/[slug]", "page");
}

async function myClub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, club: null };
  const { club } = await getMyClub<Club>(supabase, user.id, "id, name, country, phone, email");
  return { supabase, club };
}

/** Checks the times before asking the database. Null when fine. */
function checkInput(input: ClosureInput): ClosureError | null {
  const start = new Date(input.startsAt);
  const end = new Date(input.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !isReason(input.reason)) return "failed";
  if (end <= start) return "order";
  if (end <= new Date()) return "passed";
  if (end.getTime() - start.getTime() > 366 * 86_400_000) return "tooLong";
  if (input.courtIds !== null && input.courtIds.length === 0) return "noCourts";
  return null;
}

function errorOf(message: string | undefined): ClosureError {
  const m = message ?? "";
  if (m.includes("club_locked")) return "locked";
  if (m.includes("Not allowed")) return "notAllowed";
  if (m.includes("end after")) return "order";
  if (m.includes("already passed")) return "passed";
  if (m.includes("up to a year")) return "tooLong";
  if (m.includes("at least one court")) return "noCourts";
  return "failed";
}

/** The reason in one language: "Rain: wet courts", or just "Rain". */
function reasonText(locale: Locale, reason: ClosureReason, note: string | null) {
  const t = createTranslator({ locale, messages: MESSAGES[locale] as typeof en, namespace: "closures" });
  return [t(`reasons.${reason}`), note].filter(Boolean).join(": ");
}

export type ClosurePreview = { bookings: number; groups: number; names: string[] };

/** What closing would cancel, shown before the admin confirms. */
export async function previewClosure(input: ClosureInput): Promise<{ error: ClosureError } | ClosurePreview> {
  const bad = checkInput(input);
  if (bad) return { error: bad };
  const { supabase, club } = await myClub();
  if (!club) return { error: "notAllowed" };

  let courtIds = input.courtIds;
  if (courtIds === null) {
    const { data } = await supabase.from("courts").select("id").eq("club_id", club.id);
    courtIds = (data ?? []).map((c) => c.id);
  }
  if (!courtIds.length) return { bookings: 0, groups: 0, names: [] };

  const from = new Date(Math.max(new Date(input.startsAt).getTime(), Date.now())).toISOString();
  const { data, error } = await supabase
    .from("bookings")
    .select("group_id, walk_in_name, member:members(full_name), player:profiles(full_name)")
    .in("court_id", courtIds)
    .in("status", ["confirmed", "pending"])
    .lt("starts_at", input.endsAt)
    .gt("ends_at", from)
    .order("starts_at")
    .limit(500);
  if (error) {
    console.error("[closures] preview", error);
    return { error: "failed" };
  }
  const rows = (data ?? []) as unknown as {
    group_id: string | null;
    walk_in_name: string | null;
    member: { full_name: string } | null;
    player: { full_name: string | null } | null;
  }[];
  const names = [
    ...new Set(rows.map((r) => r.player?.full_name ?? r.member?.full_name ?? r.walk_in_name).filter(Boolean)),
  ] as string[];
  return {
    bookings: rows.filter((r) => !r.group_id).length,
    groups: rows.filter((r) => r.group_id).length,
    names: names.slice(0, 6),
  };
}

type Person = {
  name: string | null;
  email: string;
  locale: string | null;
  court: string | null;
  coach: string | null;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  total_price: number;
  reference: string;
};
type GroupRow = {
  group: string | null;
  starts_at: string;
  ends_at: string;
  contacts: { name: string | null; contact_name: string | null; email: string | null }[];
};

/** Closes the courts, cancels what's booked then, and emails the players. */
export async function closeCourts(
  input: ClosureInput,
): Promise<{ error: ClosureError } | { cancelled: number; emailed: number }> {
  const bad = checkInput(input);
  if (bad) return { error: bad };
  const { supabase, club } = await myClub();
  if (!club) return { error: "notAllowed" };

  const note = input.note.trim().slice(0, 200) || null;
  const clubLocale = localeForCountry(club.country);
  const { data, error } = await supabase.rpc("close_courts", {
    p_club: club.id,
    p_courts: input.courtIds,
    p_starts: new Date(input.startsAt).toISOString(),
    p_ends: new Date(input.endsAt).toISOString(),
    p_reason: input.reason,
    p_note: note,
    p_reason_text: reasonText(clubLocale, input.reason, note),
  });
  if (error) {
    console.error("[closures] close", error);
    return { error: errorOf(error.message) };
  }

  const result = (data ?? {}) as { cancelled?: number; people?: Person[]; groups?: GroupRow[] };
  let emailed = 0;

  // Bookings paid online get their money back (20261029_online_payments.sql).
  if (result.cancelled) await settleRefunds(undefined, { clubId: club.id });

  // Players (and members with an email): in the language they booked in.
  for (const p of result.people ?? []) {
    const email = courtClosedEmail({
      locale: p.locale ? pickLocale(p.locale) : clubLocale,
      name: p.name,
      courtName: p.court,
      coachName: p.coach,
      clubName: club.name,
      startsAt: p.starts_at,
      endsAt: p.ends_at,
      durationMin: p.duration_min,
      totalPrice: Number(p.total_price),
      reference: p.reference,
      appUrl: appUrl(),
      reason: input.reason,
      note,
    });
    if (await sendEmail({ to: p.email, replyTo: club.email, ...email })) emailed++;
  }

  // Groups: the parents get the usual "session cancelled" email.
  for (const g of result.groups ?? []) {
    if (!g.contacts?.length) continue;
    emailed += await emailSessionCancelled(
      club,
      { name: g.group ?? "" },
      g,
      reasonText(clubLocale, input.reason, note),
      g.contacts,
    );
  }

  refresh();
  return { cancelled: result.cancelled ?? 0, emailed };
}

/** Opens the courts again. Bookings it cancelled stay cancelled. */
export async function reopenCourts(id: string): Promise<{ error?: ClosureError }> {
  const { supabase, club } = await myClub();
  if (!club) return { error: "notAllowed" };
  const { error } = await supabase.rpc("reopen_courts", { p_closure: id });
  if (error) {
    console.error("[closures] reopen", error);
    return { error: errorOf(error.message) };
  }
  refresh();
  return {};
}
