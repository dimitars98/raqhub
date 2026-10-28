import { NextResponse } from "next/server";
import { confirmReturn, safeNext } from "@/lib/payments";
import { routing } from "@/i18n/routing";

// Where Stripe sends a player after paying. Confirms the booking straight
// away (the webhook may come a moment later), then shows their bookings.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const booking = url.searchParams.get("booking") ?? "";
  const session = url.searchParams.get("session_id") ?? "";
  const locale = (routing.locales as readonly string[]).includes(url.searchParams.get("locale") ?? "")
    ? url.searchParams.get("locale")!
    : routing.defaultLocale;

  const outcome = booking && session ? await confirmReturn(booking, session) : "unknown";
  const paid = outcome === "confirmed" || outcome === "paid";
  const next = safeNext(url.searchParams.get("next")) ?? `/${locale}/my-bookings?booked=1`;
  const target = paid ? next : `/${locale}/my-bookings?payment=${outcome === "refund_due" ? "late" : "check"}`;
  return NextResponse.redirect(new URL(target, url.origin), 303);
}
