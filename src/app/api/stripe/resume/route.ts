import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openCheckoutUrl } from "@/lib/payments";
import { routing } from "@/i18n/routing";

// "Finish paying" on My bookings: back to the booking's Stripe page while it
// is still open, otherwise to My bookings.

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
    const { data } = await supabase
      .from("bookings")
      .select("id")
      .eq("id", booking)
      .eq("player_id", user.id)
      .maybeSingle();
    const checkout = data ? await openCheckoutUrl(data.id) : null;
    if (checkout) return NextResponse.redirect(checkout, 303);
  }
  return NextResponse.redirect(new URL(`/${locale}/my-bookings?payment=check`, url.origin), 303);
}
