import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Booking } from "@/types/database";

// Which of these a club allows is checked by the database (booking rules).
const ALLOWED_DURATIONS = [30, 60, 90, 120];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { court_id, coach_id, starts_at, duration_min, notes } =
    await request.json();

  const start = new Date(starts_at);
  if (
    !court_id ||
    Number.isNaN(start.getTime()) ||
    !ALLOWED_DURATIONS.includes(duration_min)
  )
    return NextResponse.json(
      { error: "Invalid booking details" },
      { status: 400 },
    );
  if (start < new Date())
    return NextResponse.json(
      { error: "That time has already passed" },
      { status: 400 },
    );

  // End time and price are calculated here, never taken from the browser.
  const end = new Date(start.getTime() + duration_min * 60_000);

  const { data: court } = await supabase
    .from("courts")
    .select("price_per_hour")
    .eq("id", court_id)
    .single();
  if (!court)
    return NextResponse.json({ error: "Court not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      player_id: user.id,
      court_id,
      coach_id: coach_id ?? null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      duration_min,
      total_price: (court.price_per_hour * duration_min) / 60,
      status: "confirmed",
      notes: notes ?? null,
    })
    .select()
    .single();

  // 23P01 = the database's overlap rule rejected the booking
  if (error?.code === "23P01")
    return NextResponse.json(
      { error: "This slot is already booked" },
      { status: 409 },
    );
  if (error?.message?.startsWith("Booking rule:"))
    return NextResponse.json(
      { error: error.message.slice("Booking rule:".length).trim() },
      { status: 400 },
    );
  if (error) {
    console.error("[bookings]", error);
    return NextResponse.json({ error: "Booking failed" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "*, court:courts(name, club:clubs(name)), coach:coaches(profile:profiles(full_name))",
    )
    .eq("player_id", user.id)
    .order("starts_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
