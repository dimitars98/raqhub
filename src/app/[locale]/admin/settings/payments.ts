"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyClub } from "@/lib/myClub";
import { requestOrigin } from "@/lib/requestOrigin";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { settleRefunds, syncStripeAccount, type PayMode } from "@/lib/payments";

// The club side of online payments: connecting the club's own Stripe account
// and choosing how players pay. Only the owner (not staff) does this.

type PaymentsClub = {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  country: string | null;
  stripe_account_id: string | null;
};

type Result = { error?: "notConfigured" | "notOwner" | "country" | "failed" | "notReady"; url?: string };

async function ownClub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, club: null };
  const { club, isStaff } = await getMyClub<PaymentsClub>(
    supabase,
    user.id,
    "id, name, slug, email, country, stripe_account_id",
  );
  return { supabase, user, club: isStaff ? null : club };
}

/**
 * Creates the club's Stripe account (the first time) and returns Stripe's
 * page where the owner fills in the business and bank details.
 */
export async function connectStripe(): Promise<Result> {
  if (!stripeConfigured()) return { error: "notConfigured" };
  const { user, club } = await ownClub();
  if (!user || !club) return { error: "notOwner" };
  const [locale, origin] = await Promise.all([getLocale(), requestOrigin()]);
  const stripe = getStripe();

  let account = club.stripe_account_id;
  try {
    if (!account) {
      const created = await stripe.accounts.create(
        {
          country: (club.country ?? "").toUpperCase() || undefined,
          email: club.email ?? user.email ?? undefined,
          business_profile: { name: club.name, url: `${origin}/${locale}/clubs/${club.slug}` },
          // The club's own full Stripe account: it pays Stripe's fees and
          // handles its refunds and disputes; Kortello only starts payments.
          controller: {
            stripe_dashboard: { type: "full" },
            fees: { payer: "account" },
            losses: { payments: "stripe" },
            requirement_collection: "stripe",
          },
          metadata: { club_id: club.id },
        },
        { idempotencyKey: `club-account-${club.id}` },
      );
      account = created.id;
      // Only the server may set this (the database ignores it from the browser).
      const { error } = await createAdminClient()
        .from("clubs")
        .update({ stripe_account_id: account, stripe_charges_enabled: false })
        .eq("id", club.id);
      if (error) throw error;
    }

    const settings = `${origin}/${locale}/admin/settings?tab=payments`;
    const link = await stripe.accountLinks.create({
      account,
      type: "account_onboarding",
      refresh_url: `${settings}&stripe=refresh`,
      return_url: `${settings}&stripe=return`,
    });
    return { url: link.url };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[payments] connect", e);
    // Stripe doesn't take businesses from every country (e.g. North Macedonia).
    if (/country/i.test(message)) return { error: "country" };
    return { error: "failed" };
  }
}

/** Asks Stripe whether the club's account can take payments yet. */
export async function refreshStripe(): Promise<Result & { chargesEnabled?: boolean; detailsSubmitted?: boolean }> {
  if (!stripeConfigured()) return { error: "notConfigured" };
  const { club } = await ownClub();
  if (!club?.stripe_account_id) return { error: "notOwner" };
  try {
    const account = await getStripe().accounts.retrieve(club.stripe_account_id);
    const status = await syncStripeAccount(account);
    revalidatePath("/[locale]/admin/settings", "page");
    return status;
  } catch (e) {
    console.error("[payments] refresh", e);
    return { error: "failed" };
  }
}

/** How players pay: at the club, online when booking, or their choice. */
export async function savePaymentMode(mode: PayMode): Promise<Result> {
  if (!["club", "online", "either"].includes(mode)) return { error: "failed" };
  const { supabase, club } = await ownClub();
  if (!club) return { error: "notOwner" };
  const { error } = await supabase.from("clubs").update({ payment_mode: mode }).eq("id", club.id);
  if (error) {
    console.error("[payments] mode", error);
    return { error: "failed" };
  }
  revalidatePath("/[locale]/admin/settings", "page");
  return {};
}

/**
 * Refunds bookings paid online that the club just cancelled (from the
 * timetable or the bookings list). Staff can do this too.
 */
export async function settleClubRefunds(): Promise<{ refunded: number }> {
  if (!stripeConfigured()) return { refunded: 0 };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { refunded: 0 };
  const { club } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  if (!club) return { refunded: 0 };
  return { refunded: await settleRefunds(undefined, { clubId: club.id }) };
}
