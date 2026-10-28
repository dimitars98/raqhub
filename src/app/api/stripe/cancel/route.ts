import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { releaseUnpaid } from "@/lib/payments";
import { routing } from "@/i18n/routing";

// The player left Stripe's payment page without paying ("Back"): the court
// they were holding is let go straight away, and they go back to booking.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const booking = url.searchParams.get("booking") ?? "";
  const locale = (routing.locales as readonly string[]).includes(url.searchParams.get("locale") ?? "")
    ? url.searchParams.get("locale")!
    : routing.defaultLocale;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && booking) {
    // Only the player's own booking (they can read only their own).
    const { data } = await supabase
      .from("bookings")
      .select("id")
      .eq("id", booking)
      .eq("player_id", user.id)
      .maybeSingle();
    if (data) await releaseUnpaid(data.id);
  }
  return NextResponse.redirect(new URL(`/${locale}/book?payment=cancelled`, url.origin), 303);
}
