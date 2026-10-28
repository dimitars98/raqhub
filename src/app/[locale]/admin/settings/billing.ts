"use server";

import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { requestOrigin } from "@/lib/requestOrigin";
import { getPolar, polarConfigured, productFor } from "@/lib/polar";
import { clubAccess } from "@/lib/plans";
import type { Period } from "@/lib/ownerBilling";
import type { PlanId } from "@/lib/plans";

// A club paying for its Kortello plan by card, through Polar. Only the
// owner. The webhook (src/app/api/polar/webhook) records the result.

type Result = { url?: string; error?: "notConfigured" | "notOwner" | "failed" };

type BillingClub = {
  id: string;
  name: string;
  email: string | null;
  trial_ends_at: string | null;
  polar_subscription_id: string | null;
  subscription_status: string | null;
};

async function ownClub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, club: null };
  const { club, isStaff } = await getMyClub<BillingClub>(
    supabase,
    user.id,
    "id, name, email, trial_ends_at, polar_subscription_id, subscription_status",
  );
  return { user, club: isStaff ? null : club };
}

const LIVE = ["active", "trialing", "past_due"];

/** Polar's checkout for a plan. The rest of a free trial stays free. */
export async function startSubscription(plan: PlanId, period: Period): Promise<Result> {
  if (!polarConfigured()) return { error: "notConfigured" };
  const product = productFor(plan, period);
  if (!product) return { error: "notConfigured" };
  const { user, club } = await ownClub();
  if (!user || !club) return { error: "notOwner" };
  // Already paying by card: plan changes go through the subscription page.
  if (club.polar_subscription_id && LIVE.includes(club.subscription_status ?? "")) return manageSubscription();

  const [locale, origin] = await Promise.all([getLocale(), requestOrigin()]);
  const settings = `${origin}/${locale}/admin/settings`;
  const trialDays = clubAccess({ trial_ends_at: club.trial_ends_at }).trialDaysLeft;
  try {
    const checkout = await getPolar().checkouts.create({
      products: [product],
      external_customer_id: club.id,
      customer_email: club.email ?? user.email ?? null,
      customer_name: club.name,
      is_business_customer: true,
      metadata: { club_id: club.id, plan, period },
      // Paying during the free trial: the first charge comes when it ends.
      ...(trialDays > 0 ? { allow_trial: true, trial_interval: "day" as const, trial_interval_count: trialDays } : {}),
      success_url: `${settings}?subscribed=1`,
      return_url: settings,
      // Polar's checkout speaks fewer languages than Kortello.
      ...(["en", "de", "fr", "it"].includes(locale) ? { locale } : {}),
    });
    return { url: checkout.url };
  } catch (e) {
    console.error("[billing] checkout", e);
    return { error: "failed" };
  }
}

/** Polar's page where the owner changes plan or card, sees invoices or cancels. */
export async function manageSubscription(): Promise<Result> {
  if (!polarConfigured()) return { error: "notConfigured" };
  const { club } = await ownClub();
  if (!club) return { error: "notOwner" };
  const [locale, origin] = await Promise.all([getLocale(), requestOrigin()]);
  try {
    const session = await getPolar().customerSessions.create({
      external_customer_id: club.id,
      return_url: `${origin}/${locale}/admin/settings`,
    });
    return { url: session.customer_portal_url };
  } catch (e) {
    console.error("[billing] portal", e);
    return { error: "failed" };
  }
}
