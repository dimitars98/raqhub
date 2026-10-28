import Stripe from "stripe";

// Kortello's Stripe account (the "platform"). Clubs connect their own Stripe
// accounts to it, and players pay the club directly ("direct charges"):
// see supabase/migrations/20261029_online_payments.sql.
//
// Server only: the secret key must never reach the browser.
//
//   STRIPE_SECRET_KEY        sk_test_… while testing, sk_live_… when live
//   STRIPE_WEBHOOK_SECRET    whsec_… of the Connect webhook (see README)
//   KORTELLO_FEE_PERCENT     optional: Kortello's cut of each payment (0 = none)

let client: Stripe | null = null;

export function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key, { appInfo: { name: "Kortello" } });
  return client;
}

/** True with test keys: no real money moves. */
export const stripeTestMode = () => (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");

export const CURRENCY = "eur";

export const toCents = (amount: number) => Math.round(amount * 100);

/** Kortello's cut of a payment, in cents (none unless KORTELLO_FEE_PERCENT is set). */
export function platformFee(cents: number) {
  const pct = Number(process.env.KORTELLO_FEE_PERCENT ?? 0);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(cents, Math.round((cents * pct) / 100));
}

/** The checkout page's language; Stripe has no Macedonian, Albanian or Serbian. */
export function checkoutLocale(locale: string): Stripe.Checkout.SessionCreateParams.Locale {
  return (["en", "de", "fr", "it"] as const).find((l) => l === locale) ?? "auto";
}
