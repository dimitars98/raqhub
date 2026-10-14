"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import type { MyMembership } from "@/types/database";
import { sendEmail } from "@/lib/email/send";
import { bookingCancelledEmail, bookingConfirmedEmail } from "@/lib/email/templates";
import {
  BOOKING_EMAIL_SELECT,
  bookingEmailData,
  clubEmailOf,
  type BookingEmailRow,
} from "@/lib/email/bookings";

// Every length any club can offer. Which of these a club actually allows is
// checked by the database (see 20261014_booking_rules.sql).
const ALLOWED_DURATIONS = [30, 60, 90, 120];

type Supabase = Awaited<ReturnType<typeof createClient>>;

type BookingInput = {
  court_id: string;
  starts_at: string;
  duration_min: number;
};

type CoachBookingInput = {
  coach_id: string;
  starts_at: string;
  duration_min: number;
};

type Result = { error: string } | never;

/** Checks the time and duration a player picked. Null when fine. */
function checkTime(startsAt: string, duration: number) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime()) || !ALLOWED_DURATIONS.includes(duration))
    return { start, error: "invalid" as const };
  if (start < new Date()) return { start, error: "passed" as const };
  return { start, error: null };
}

/** Discount (%) from an active membership at this club, or 0. */
async function memberDiscount(supabase: Supabase, clubId: string | null) {
  if (!clubId) return 0;
  const { data } = await supabase.rpc("my_memberships");
  const membership = ((data ?? []) as unknown as MyMembership[]).find(
    (m) => m.club_id === clubId && m.status === "active",
  );
  return membership?.plan?.discount_pct ?? 0;
}

type SignedInUser = { email?: string | null; user_metadata?: { full_name?: string } };

/**
 * Confirmation email after a booking. Looked up separately from the insert,
 * so a problem here can never make a saved booking look like it failed.
 */
async function sendConfirmation(supabase: Supabase, user: SignedInUser, bookingId?: string) {
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
async function bookingError(error: { code?: string; message?: string }, what: "court" | "coach") {
  const t = await getTranslations("bookingErrors");
  const message = error.message ?? "";
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

// The final price is always worked out again by the database when the
// booking is saved (see supabase/migrations), so nothing here can be tampered
// with from the browser. The values below only keep the two in step.

export async function createBooking(input: BookingInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: (await getTranslations("bookingErrors"))("notSignedIn") };

  const { start, error: timeError } = checkTime(input.starts_at, input.duration_min);
  if (timeError) return { error: (await getTranslations("bookingErrors"))(timeError) };
  const end = new Date(start.getTime() + input.duration_min * 60_000);

  const { data: court } = await supabase
    .from("courts")
    .select("price_per_hour, club_id")
    .eq("id", input.court_id)
    .single();
  if (!court) return { error: (await getTranslations("bookingErrors"))("courtNotFound") };

  const discount = await memberDiscount(supabase, court.club_id);
  const basePrice = (court.price_per_hour * input.duration_min) / 60;
  const total_price = Math.round(basePrice * (1 - discount / 100) * 100) / 100;

  const locale = await getLocale();
  const { data: saved, error } = await supabase
    .from("bookings")
    .insert({
    player_id: user.id,
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

  if (error) {
    if (error.code !== "23P01") console.error("[createBooking]", error);
    return { error: await bookingError(error, "court") };
  }

  await sendConfirmation(supabase, user, saved?.id);

  redirect("/my-bookings?booked=1");
}

/**
 * A lesson with a coach. The database gives it a free court at the coach's
 * club (see 20261015_lessons_hold_court.sql); coaches without a club have none.
 */
export async function createCoachBooking(input: CoachBookingInput): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: (await getTranslations("bookingErrors"))("notSignedIn") };

  const { start, error: timeError } = checkTime(input.starts_at, input.duration_min);
  if (timeError) return { error: (await getTranslations("bookingErrors"))(timeError) };
  const end = new Date(start.getTime() + input.duration_min * 60_000);

  const { data: coach } = await supabase
    .from("coaches")
    .select("price_per_hour, club_id")
    .eq("id", input.coach_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!coach) return { error: (await getTranslations("bookingErrors"))("coachNotAvailable") };

  const discount = await memberDiscount(supabase, coach.club_id);
  const basePrice = (coach.price_per_hour * input.duration_min) / 60;
  const total_price = Math.round(basePrice * (1 - discount / 100) * 100) / 100;

  const locale = await getLocale();
  const { data: saved, error } = await supabase
    .from("bookings")
    .insert({
    player_id: user.id,
    coach_id: input.coach_id,
    court_id: null,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    duration_min: input.duration_min,
    total_price,
    status: "confirmed",
    notes: null,
    locale,
  })
    .select("id")
    .single();

  if (error) {
    if (error.code !== "23P01") console.error("[createCoachBooking]", error);
    return { error: await bookingError(error, "coach") };
  }

  await sendConfirmation(supabase, user, saved?.id);

  redirect("/my-bookings?booked=1");
}

/** A player cancels one of their own bookings. */
export async function cancelBooking(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: cancelled } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("player_id", user.id)
    .in("status", ["confirmed", "pending"])
    .select(BOOKING_EMAIL_SELECT)
    .maybeSingle();

  // Only when this call really cancelled it (not a double click).
  if (cancelled && user.email) {
    const row = cancelled as unknown as BookingEmailRow;
    const email = bookingCancelledEmail(
      bookingEmailData(row, user.user_metadata?.full_name ?? null, await getLocale()),
    );
    await sendEmail({ to: user.email, replyTo: clubEmailOf(row), ...email });
  }

  revalidatePath("/[locale]/my-bookings", "page");
}
