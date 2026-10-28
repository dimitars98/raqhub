import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { normalizeHours } from "@/lib/openingHours";
import { normalizeRules } from "@/lib/bookingRules";
import SettingsClient, { type SettingsClub } from "@/components/admin/SettingsClient";
import { PlanCard } from "@/components/admin/PlanNotices";
import { BILLING_COLUMNS, clubAccess } from "@/lib/plans";
import { getStripe, stripeConfigured, stripeTestMode } from "@/lib/stripe";
import { syncStripeAccount } from "@/lib/payments";
import { payModeOf } from "@/lib/paymentMode";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; stripe?: string }>;
}) {
  const { tab, stripe } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: clubData }, { data: profile }] = await Promise.all([
    supabase
      .from("clubs")
      .select(
        `id, name, slug, email, phone, address, city, country, website, description, logo_url, opening_hours, booking_rules, payment_mode, stripe_account_id, stripe_charges_enabled, ${BILLING_COLUMNS}`,
      )
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, phone, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!clubData) redirect("/admin/setup");

  // Back from Stripe's setup pages: ask Stripe whether the account is ready.
  let ready = !!clubData.stripe_charges_enabled;
  if (stripe && clubData.stripe_account_id && stripeConfigured()) {
    try {
      const account = await getStripe().accounts.retrieve(clubData.stripe_account_id);
      ready = (await syncStripeAccount(account)).chargesEnabled;
    } catch (e) {
      console.error("[settings] stripe", e);
    }
  }

  const club: SettingsClub = {
    ...clubData,
    country: clubData.country ?? "MK",
    opening_hours: normalizeHours(clubData.opening_hours),
    booking_rules: normalizeRules(clubData.booking_rules),
  };

  return (
    <>
      <PlanCard club={clubData} access={clubAccess(clubData)} />
      <SettingsClient
        club={club}
        initialTab={stripe ? "payments" : tab}
        payments={{
          configured: stripeConfigured(),
          testMode: stripeTestMode(),
          connected: !!clubData.stripe_account_id,
          ready,
          mode: payModeOf({ payment_mode: clubData.payment_mode, stripe_charges_enabled: true }),
          // Only the owner's own club comes back here (staff use another query).
          isOwner: true,
        }}
        profile={{
          userId: user.id,
          full_name: profile?.full_name ?? "",
          phone: profile?.phone ?? "",
          avatar_url: profile?.avatar_url ?? null,
        }}
      />
    </>
  );
}
