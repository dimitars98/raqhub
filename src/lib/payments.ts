import type Stripe from "stripe";
import { getLocale, getTranslations } from "next-intl/server";
import { requestOrigin } from "@/lib/requestOrigin";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENCY, checkoutLocale, getStripe, platformFee, toCents } from "@/lib/stripe";
import { sendConfirmation } from "@/lib/courtBooking";
import { PAY_WINDOW_MIN, payModeOf, type PayMode } from "@/lib/paymentMode";

// Paying for a court online (supabase/migrations/20261029_online_payments.sql).
// Server only. The database decides when a booking waits for payment; this
// file talks to Stripe: opens the checkout, confirms the payment, gives
// money back, and lets go of bookings nobody paid for.
//
// Every Stripe call is made on the club's own account ({ stripeAccount }), so
// the payment, its fees and any refund are the club's.

type Admin = ReturnType<typeof createAdminClient>;

export { PAY_WINDOW_MIN, payModeOf };
export type { PayMode };

/** Keeps a "next" page inside the app. */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") ? next : null;

type CheckoutBooking = {
  id: string;
  player_id: string | null;
  starts_at: string;
  duration_min: number;
  total_price: number;
  payment_status: string;
  court: { name: string; club: { name: string; stripe_account_id: string | null } | null } | null;
};

/**
 * Opens Stripe's payment page for a booking that is waiting for payment.
 * Returns the page to send the player to.
 */
export async function startCheckout(
  bookingId: string,
  opts: { email?: string | null; locale: string; origin: string; next?: string | null },
): Promise<{ url: string } | { error: "unavailable" }> {
  const db = createAdminClient();
  const { data } = await db
    .from("bookings")
    .select(
      "id, player_id, starts_at, duration_min, total_price, payment_status, court:courts(name, club:clubs(name, stripe_account_id))",
    )
    .eq("id", bookingId)
    .maybeSingle();
  const b = data as unknown as CheckoutBooking | null;
  const account = b?.court?.club?.stripe_account_id;
  if (!b || b.payment_status !== "pending" || !account) return { error: "unavailable" };

  const amount = toCents(Number(b.total_price));
  const fee = platformFee(amount);
  const when = new Date(b.starts_at).toLocaleString(opts.locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Skopje",
  });
  const back = new URLSearchParams({ booking: b.id, locale: opts.locale });
  const next = safeNext(opts.next);
  if (next) back.set("next", next);

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: CURRENCY,
              unit_amount: amount,
              product_data: {
                name: `${b.court?.name ?? "Court"} · ${when}`,
                description: `${b.duration_min} min · ${b.court?.club?.name ?? ""}`.trim(),
              },
            },
          },
        ],
        payment_intent_data: {
          ...(fee > 0 ? { application_fee_amount: fee } : {}),
          metadata: { booking_id: b.id },
        },
        metadata: { booking_id: b.id },
        client_reference_id: b.id,
        ...(opts.email ? { customer_email: opts.email } : {}),
        locale: checkoutLocale(opts.locale),
        // Stripe's shortest: 30 minutes. The court is held a minute longer.
        expires_at: Math.floor(Date.now() / 1000) + (PAY_WINDOW_MIN - 1) * 60 + 30,
        success_url: `${opts.origin}/api/stripe/return?${back.toString()}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${opts.origin}/api/stripe/cancel?${back.toString()}`,
      },
      { stripeAccount: account, idempotencyKey: `checkout-${b.id}` },
    );
    await db
      .from("bookings")
      .update({ stripe_checkout_session_id: session.id, stripe_account_id: account })
      .eq("id", b.id);
    if (!session.url) return { error: "unavailable" };
    return { url: session.url };
  } catch (e) {
    console.error("[payments] checkout", e);
    return { error: "unavailable" };
  }
}

/**
 * For the booking actions: Stripe's payment page for a booking that waits
 * for payment, or (if it can't open) the court let go and a message.
 * `next`: where the player lands after paying, without the language.
 */
export async function checkoutOrRelease(bookingId: string, email: string | null, next: string) {
  const [locale, origin] = await Promise.all([getLocale(), requestOrigin()]);
  const checkout = await startCheckout(bookingId, { email, locale, origin, next: `/${locale}${next}` });
  if ("url" in checkout) return { checkoutUrl: checkout.url };
  await releaseUnpaid(bookingId);
  return { error: (await getTranslations("bookingErrors"))("paymentUnavailable") };
}

/** Lets go of a booking that is still waiting for payment (and closes its checkout). */
export async function releaseUnpaid(bookingId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("bookings")
    .update({ status: "cancelled", payment_status: "expired", pay_by: null })
    .eq("id", bookingId)
    .eq("payment_status", "pending")
    .select("stripe_checkout_session_id, stripe_account_id")
    .maybeSingle();
  if (data?.stripe_checkout_session_id && data.stripe_account_id) {
    await expireSession(data.stripe_checkout_session_id, data.stripe_account_id);
  }
}

async function expireSession(sessionId: string, account: string) {
  try {
    await getStripe().checkout.sessions.expire(sessionId, {}, { stripeAccount: account });
  } catch {
    // Already paid, expired or closed: nothing to do.
  }
}

/**
 * Records a finished Stripe checkout: confirms the booking (or, if it was
 * let go in the meantime, refunds it) and emails the player. Called by the
 * page Stripe sends the player back to and by the webhook; whichever comes
 * second changes nothing.
 */
export async function recordCheckout(session: Stripe.Checkout.Session, account: string) {
  const bookingId = session.metadata?.booking_id ?? session.client_reference_id;
  if (!bookingId || session.payment_status !== "paid") return "unpaid";
  const db = createAdminClient();
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? "");
  const { data: outcome, error } = await db.rpc("confirm_online_payment", {
    p_booking: bookingId,
    p_session: session.id,
    p_payment_intent: paymentIntent,
    p_amount: (session.amount_total ?? 0) / 100,
    p_account: account,
  });
  if (error) {
    console.error("[payments] confirm", error);
    return "error";
  }
  if (outcome === "refund_due") await settleRefunds(db, { ids: [bookingId] });
  if (outcome === "confirmed") await emailPlayer(db, bookingId);
  return outcome as string;
}

async function emailPlayer(db: Admin, bookingId: string) {
  try {
    const { data: b } = await db.from("bookings").select("player_id").eq("id", bookingId).maybeSingle();
    if (!b?.player_id) return;
    const { data } = await db.auth.admin.getUserById(b.player_id);
    if (!data.user) return;
    // The same confirmation email as a booking paid at the club.
    await sendConfirmation(db, data.user, bookingId);
  } catch (e) {
    console.error("[payments] email", e);
  }
}

/** Confirms a checkout the player came back from (when the webhook hasn't yet). */
export async function confirmReturn(bookingId: string, sessionId: string) {
  const db = createAdminClient();
  const { data: b } = await db
    .from("bookings")
    .select("stripe_account_id, stripe_checkout_session_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b?.stripe_account_id || b.stripe_checkout_session_id !== sessionId) return "unknown";
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount: b.stripe_account_id });
    return await recordCheckout(session, b.stripe_account_id);
  } catch (e) {
    console.error("[payments] return", e);
    return "error";
  }
}

/** The checkout page of a booking still waiting for payment, if it is still open. */
export async function openCheckoutUrl(bookingId: string) {
  const db = createAdminClient();
  const { data: b } = await db
    .from("bookings")
    .select("payment_status, stripe_account_id, stripe_checkout_session_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (b?.payment_status !== "pending" || !b.stripe_account_id || !b.stripe_checkout_session_id) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(b.stripe_checkout_session_id, {}, {
      stripeAccount: b.stripe_account_id,
    });
    return session.status === "open" ? session.url : null;
  } catch {
    return null;
  }
}

/**
 * Gives back the money of cancelled paid bookings (payment_status
 * refund_due). Pass booking ids, or a club to do all of its bookings.
 * What fails stays refund_due and is tried again by the hourly job.
 */
export async function settleRefunds(db: Admin = createAdminClient(), opts: { ids?: string[]; clubId?: string } = {}) {
  let query = db
    .from("bookings")
    .select("id, stripe_payment_intent_id, stripe_account_id, court:courts!inner(club_id)")
    .eq("payment_status", "refund_due")
    .limit(50);
  if (opts.ids?.length) query = query.in("id", opts.ids);
  if (opts.clubId) query = query.eq("court.club_id", opts.clubId);
  const { data } = await query;
  let refunded = 0;
  for (const b of (data ?? []) as { id: string; stripe_payment_intent_id: string | null; stripe_account_id: string | null }[]) {
    if (!b.stripe_payment_intent_id || !b.stripe_account_id) continue;
    try {
      await getStripe().refunds.create(
        { payment_intent: b.stripe_payment_intent_id, refund_application_fee: true },
        { stripeAccount: b.stripe_account_id, idempotencyKey: `refund-${b.id}` },
      );
      await db
        .from("bookings")
        .update({ payment_status: "refunded", refunded_at: new Date().toISOString() })
        .eq("id", b.id);
      refunded++;
    } catch (e) {
      console.error("[payments] refund", b.id, e);
    }
  }
  return refunded;
}

/** Hourly: lets go of bookings nobody paid for, and retries refunds. */
export async function runPaymentJobs(db: Admin) {
  const { data, error } = await db.rpc("expire_unpaid_bookings");
  if (error) throw error;
  for (const row of data ?? []) {
    if (row.stripe_checkout_session_id && row.club_account) {
      await expireSession(row.stripe_checkout_session_id, row.club_account);
    }
  }
  const refunded = await settleRefunds(db);
  return { released: (data ?? []).length, refunded };
}

/** Saves whether a club's Stripe account can take payments yet. */
export async function syncStripeAccount(account: Stripe.Account) {
  const db = createAdminClient();
  await db
    .from("clubs")
    .update({ stripe_charges_enabled: !!account.charges_enabled })
    .eq("stripe_account_id", account.id);
  return { chargesEnabled: !!account.charges_enabled, detailsSubmitted: !!account.details_submitted };
}
