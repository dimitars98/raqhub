"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkoutOrRelease, settleRefunds } from "@/lib/payments";
import { getLocale, getTranslations } from "next-intl/server";
import { sendEmail } from "@/lib/email/send";
import { bookingCancelledEmail } from "@/lib/email/templates";
import {
  BOOKING_EMAIL_SELECT,
  bookingEmailData,
  clubEmailOf,
  type BookingEmailRow,
} from "@/lib/email/bookings";
import {
  bookingError,
  checkTime,
  insertCourtBooking,
  memberDiscount,
  sendConfirmation,
  type BookingInput,
  type CoachBookingInput,
  type Result,
} from "@/lib/courtBooking";

// The final price is always worked out again by the database when the
// booking is saved (see supabase/migrations), so nothing here can be tampered
// with from the browser. The values below only keep the two in step.

/**
 * Books a court. When the club takes payment online, returns Stripe's
 * payment page to send the player to; the booking is confirmed (and the
 * email sent) once they have paid.
 */
export async function createBooking(
  input: BookingInput & { payOnline?: boolean },
): Promise<{ error?: string; checkoutUrl?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: (await getTranslations("bookingErrors"))("notSignedIn") };

  const saved = await insertCourtBooking(supabase, user.id, input, !!input.payOnline);
  if (saved.error !== undefined) return { error: saved.error };

  if (saved.pending) return checkoutOrRelease(saved.id, user.email ?? null, "/my-bookings?booked=1");

  await sendConfirmation(supabase, user, saved.id);

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

  // Paid online: the money goes back (20261029_online_payments.sql).
  if (cancelled) await settleRefunds(undefined, { ids: [id] });

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
