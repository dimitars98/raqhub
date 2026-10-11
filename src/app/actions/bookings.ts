"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const ALLOWED_DURATIONS = [60, 90, 120];

type BookingInput = {
  court_id: string;
  starts_at: string;
  duration_min: number;
};

export async function createBooking(
  input: BookingInput,
): Promise<{ error: string } | never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const start = new Date(input.starts_at);
  if (
    Number.isNaN(start.getTime()) ||
    !ALLOWED_DURATIONS.includes(input.duration_min)
  )
    return { error: "Invalid booking details" };
  if (start < new Date()) return { error: "That time has already passed" };

  const end = new Date(start.getTime() + input.duration_min * 60_000);

  // Price comes from the database, never from the browser.
  const { data: court } = await supabase
    .from("courts")
    .select("price_per_hour")
    .eq("id", input.court_id)
    .single();
  if (!court) return { error: "Court not found" };

  // ▼▼▼ NEW: member discount ▼▼▼
  // Same lookup the form does, but on the server where it can't be tampered with.
  const { data: member } = await supabase
    .from("members")
    .select("plan:membership_plans(discount_pct)")
    .eq("email", user.email!)
    .eq("status", "active")
    .maybeSingle();
  const discount =
    (member?.plan as { discount_pct: number } | null)?.discount_pct ?? 0;

  const basePrice = (court.price_per_hour * input.duration_min) / 60;
  const total_price = Math.round(basePrice * (1 - discount / 100) * 100) / 100;
  // ▲▲▲ NEW ▲▲▲

  const { error } = await supabase.from("bookings").insert({
    player_id: user.id,
    court_id: input.court_id,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    duration_min: input.duration_min,
    total_price, // ← was: (court.price_per_hour * input.duration_min) / 60
    status: "confirmed",
    coach_id: null,
    notes: null,
  });

  if (error?.code === "23P01") return { error: "This slot is already booked" };
  if (error) {
    console.error("[createBooking]", error);
    return { error: "Booking failed" };
  }

  redirect("/my-bookings?booked=1");
}
