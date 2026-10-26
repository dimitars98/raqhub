import { getLocale, getTranslations } from "next-intl/server";
import type { createClient } from "@/lib/supabase/server";
import type { MyMembership } from "@/types/database";
import { sendEmail } from "@/lib/email/send";
import { bookingConfirmedEmail } from "@/lib/email/templates";
import {
  BOOKING_EMAIL_SELECT,
  bookingEmailData,
  clubEmailOf,
  type BookingEmailRow,
} from "@/lib/email/bookings";

// Booking a court as a player: shared by the booking screens
// (src/app/actions/bookings.ts) and open matches (src/app/actions/openMatches.ts).
// Server-only: it is imported by server actions, never by components.

// Every length any club can offer. Which of these a club actually allows is
// checked by the database (see 20261014_booking_rules.sql).
const ALLOWED_DURATIONS = [30, 60, 90, 120];

export type Supabase = Awaited<ReturnType<typeof createClient>>;

export type BookingInput = {
  court_id: string;
  starts_at: string;
  duration_min: number;
};

export type CoachBookingInput = {
  coach_id: string;
  starts_at: string;
  duration_min: number;
};

export type Result = { error: string } | never;

/** Checks the time and duration a player picked. Null when fine. */
export function checkTime(startsAt: string, duration: number) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime()) || !ALLOWED_DURATIONS.includes(duration))
    return { start, error: "invalid" as const };
  if (start < new Date()) return { start, error: "passed" as const };
  return { start, error: null };
}

/** Discount (%) from an active membership at this club, or 0. */
export async function memberDiscount(supabase: Supabase, clubId: string | null) {
  if (!clubId) return 0;
  const { data } = await supabase.rpc("my_memberships");
  const membership = ((data ?? []) as unknown as MyMembership[]).find(
    (m) => m.club_id === clubId && m.status === "active",
  );
  return membership?.plan?.discount_pct ?? 0;
}

export type SignedInUser = { email?: string | null; user_metadata?: { full_name?: string } };

/**
 * Confirmation email after a booking. Looked up separately from the insert,
 * so a problem here can never make a saved booking look like it failed.
 */
export async function sendConfirmation(supabase: Supabase, user: SignedInUser, bookingId?: string) {
  if (!bookingId || !user.email) return;
  try {
    const { data } = await supabase
      .from("bookings")
      .select(BOOKING_EMAIL_SELECT)
      .eq("id", bookingId)
      .maybeSingle();
    if (!data) return;
    const row = data as unknown as BookingEmailRow;
    const email = bookingConfirmedEmail(bookingEmailData(row, user.user_metadata?.full_name ?? null));
    await sendEmail({ to: user.email, replyTo: clubEmailOf(row), ...email });
  } catch (e) {
    console.error("[booking email]", e);
  }
}

/** Turns a database refusal into a message a player understands. */
export async function bookingError(error: { code?: string; message?: string }, what: "court" | "coach") {
  const t = await getTranslations("bookingErrors");
  const message = error.message ?? "";
  // The club's free trial has ended (see 20261025_trial_lock.sql).
  if (message.includes("club_locked")) return t("clubPaused");
  // The club closed the court then (see 20261027_court_closures.sql).
  if (message.includes("court_closed")) return t("courtClosed");
  if (error.code === "23P01") {
    // For a lesson the clash can be the coach or the court it was given.
    if (what === "coach") return message.includes("coach") ? t("coachTaken") : t("noCourtFree");
    return t("slotTaken");
  }
  // The club's own booking rules (see 20261014_booking_rules.sql). The
  // database writes them in English with a number; shown in the player's language.
  if (message.startsWith("Booking rule:")) {
    const rules: [RegExp, string][] = [
      [/take (\d+) minute bookings/, "ruleLength"],
      [/up to (\d+) days ahead/, "ruleDaysAhead"],
      [/up to (\d+) bookings a day/, "rulePerDay"],
      [/cancelling up to (\d+) hours/, "ruleCancel"],
      [/paused after (\d+) missed/, "ruleNoShows"],
    ];
    for (const [pattern, key] of rules) {
      const m = message.match(pattern);
      if (m) return t(key, { n: Number(m[1]) });
    }
    return message.slice("Booking rule:".length).trim();
  }
  if (message.includes("No court is free")) return t("noCourtFree");
  if (message.includes("closed")) return t("closedDay");
  if (message.includes("opening hours")) return t("outsideHours");
  if (message.includes("already passed")) return t("passed");
  if (message.includes("not available")) return t("notAvailable");
  return t("failed");
}

/**
 * Saves a court booking for the signed-in player, at the price the database
 * works out (member discount included). Returns its id, or an error in the
 * player's language. Sends no email: the caller does, once it's sure.
 */
export async function insertCourtBooking(
  supabase: Supabase,
  userId: string,
  input: BookingInput,
): Promise<{ id: string; error?: undefined } | { id?: undefined; error: string }> {
  const t = await getTranslations("bookingErrors");
  const { start, error: timeError } = checkTime(input.starts_at, input.duration_min);
  if (timeError) return { error: t(timeError) };
  const end = new Date(start.getTime() + input.duration_min * 60_000);

  const { data: court } = await supabase
    .from("courts")
    .select("price_per_hour, club_id")
    .eq("id", input.court_id)
    .single();
  if (!court) return { error: t("courtNotFound") };

  const discount = await memberDiscount(supabase, court.club_id);
  const basePrice = (court.price_per_hour * input.duration_min) / 60;
  const total_price = Math.round(basePrice * (1 - discount / 100) * 100) / 100;

  const locale = await getLocale();
  const { data: saved, error } = await supabase
    .from("bookings")
    .insert({
      player_id: userId,
      court_id: input.court_id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      duration_min: input.duration_min,
      total_price,
      status: "confirmed",
      coach_id: null,
      notes: null,
      locale,
    })
    .select("id")
    .single();

  if (error || !saved) {
    if (error?.code !== "23P01") console.error("[insertCourtBooking]", error);
    return { error: await bookingError(error ?? {}, "court") };
  }
  return { id: saved.id };
}
