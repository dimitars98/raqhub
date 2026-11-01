import { NextResponse } from "next/server";
import { webhooks } from "@polar-sh/sdk/2026-10";
import { createAdminClient } from "@/lib/supabase/admin";
import { planOfProduct } from "@/lib/polar";

// Polar's messages about the clubs' card subscriptions to RaqHub
// (supabase/migrations/20261029b_polar_subscriptions.sql). Set up in Polar:
// Settings → Webhooks → this address, with the subscription.* and
// order.paid events; its secret goes in POLAR_WEBHOOK_SECRET.

export const dynamic = "force-dynamic";

type Sub = Extract<webhooks.WebhookPayload, { type: "subscription.updated" }>["data"];
type Order = Extract<webhooks.WebhookPayload, { type: "order.paid" }>["data"];

const day = (iso: string) => iso.slice(0, 10);

/** The club a subscription or order belongs to (we create customers with the club's id). */
const clubOf = (external: string | null | undefined, metadata: Record<string, unknown> | null | undefined) =>
  external ?? (typeof metadata?.club_id === "string" ? metadata.club_id : null);

async function saveSubscription(sub: Sub) {
  const clubId = clubOf(sub.customer?.external_id, sub.metadata);
  if (!clubId) return;
  const bought = planOfProduct(sub.product_id);
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  const db = createAdminClient();
  const { data: club } = await db
    .from("clubs")
    .select("paid_until, polar_subscription_id, subscription_status")
    .eq("id", clubId)
    .maybeSingle();
  if (!club) return;
  // Late news about an older subscription doesn't undo a newer one.
  if (
    club.polar_subscription_id &&
    club.polar_subscription_id !== sub.id &&
    !live &&
    ["active", "trialing", "past_due"].includes(club.subscription_status ?? "")
  ) {
    return;
  }

  const update: {
    polar_subscription_id: string;
    subscription_status: string;
    subscription_period: string | null;
    subscription_ends: boolean;
    plan?: string;
    paid_until?: string;
  } = {
    polar_subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_period: bought?.period ?? null,
    subscription_ends: sub.cancel_at_period_end || !live,
  };
  if (bought) update.plan = bought.plan;
  // Paid (or in the free trial) through the end of the current period. A
  // failed renewal leaves it as it was: the usual grace days, then read-only.
  // Never shortens time already paid (e.g. a bank transfer for the year).
  if (live && sub.status !== "past_due" && sub.current_period_end) {
    const end = day(sub.current_period_end);
    update.paid_until = club.paid_until && club.paid_until > end ? club.paid_until : end;
  }
  const { error } = await db.from("clubs").update(update).eq("id", clubId);
  if (error) throw error;
}

async function savePayment(order: Order) {
  const clubId = clubOf(order.customer?.external_id, order.metadata);
  if (!clubId || order.total_amount <= 0) return;
  const bought = planOfProduct(order.product_id);
  const db = createAdminClient();
  const { data: club } = await db.from("clubs").select("plan, paid_until").eq("id", clubId).maybeSingle();
  if (!club) return;
  const { error } = await db.from("club_payments").upsert(
    {
      club_id: clubId,
      plan: bought?.plan ?? club.plan,
      period: bought?.period ?? "month",
      amount: order.total_amount / 100,
      method: "card",
      paid_until: club.paid_until ?? day(new Date().toISOString()),
      polar_order_id: order.id,
    },
    { onConflict: "polar_order_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

export async function POST(request: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "POLAR_WEBHOOK_SECRET is not set" }, { status: 503 });

  const body = await request.text();
  let event: webhooks.WebhookPayload;
  try {
    event = await webhooks.validateEvent(body, Object.fromEntries(request.headers), secret);
  } catch (e) {
    if (e instanceof webhooks.PolarWebhookUnknownTypeError) return NextResponse.json({ ignored: true });
    console.error("[polar webhook] signature", e);
    return NextResponse.json({ error: "Bad signature" }, { status: 403 });
  }

  try {
    switch (event.type) {
      case "subscription.created":
      case "subscription.active":
      case "subscription.updated":
      case "subscription.canceled":
      case "subscription.uncanceled":
      case "subscription.revoked":
      case "subscription.past_due":
      case "subscription.cycled":
        await saveSubscription(event.data as Sub);
        break;
      case "order.paid":
        await savePayment(event.data);
        break;
    }
  } catch (e) {
    console.error(`[polar webhook] ${event.type}`, e);
    // Polar tries again later.
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
