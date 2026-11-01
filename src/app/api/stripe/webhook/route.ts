import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCheckout, syncStripeAccount } from "@/lib/payments";

// Stripe's messages about the clubs' accounts ("Connect" webhook): payments,
// checkouts that ran out, refunds made in Stripe, accounts becoming ready.
// Set up in Stripe: Developers → Webhooks → "Events on connected accounts",
// pointing here, with STRIPE_WEBHOOK_SECRET from it (see README).

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 503 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch (e) {
    console.error("[stripe webhook] signature", e);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  // Events from a club's account say which one.
  const account = event.account;
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        if (account) await recordCheckout(event.data.object, account);
        break;

      case "checkout.session.expired": {
        // The player never paid: let the court go.
        const bookingId = event.data.object.metadata?.booking_id;
        if (bookingId) {
          await createAdminClient()
            .from("bookings")
            .update({ status: "cancelled", payment_status: "expired", pay_by: null })
            .eq("id", bookingId)
            .eq("payment_status", "pending");
        }
        break;
      }

      case "charge.refunded": {
        // A refund made in Stripe (by RaqHub or by the club in its dashboard).
        const charge = event.data.object;
        const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (intent && charge.refunded) {
          await createAdminClient()
            .from("bookings")
            .update({ payment_status: "refunded", refunded_at: new Date().toISOString() })
            .eq("stripe_payment_intent_id", intent)
            .in("payment_status", ["paid", "refund_due"]);
        }
        break;
      }

      case "account.updated":
        await syncStripeAccount(event.data.object);
        break;
    }
  } catch (e) {
    console.error(`[stripe webhook] ${event.type}`, e);
    // Stripe tries again later.
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
