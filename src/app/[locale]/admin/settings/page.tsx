import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { normalizeHours } from "@/lib/openingHours";
import { normalizeRules } from "@/lib/bookingRules";
import SettingsClient, { type SettingsClub } from "@/components/admin/SettingsClient";
import { PlanCard } from "@/components/admin/PlanNotices";
import { BILLING_COLUMNS, clubAccess } from "@/lib/plans";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: clubData }, { data: profile }] = await Promise.all([
    supabase
      .from("clubs")
      .select(
        `id, name, slug, email, phone, address, city, country, website, description, logo_url, opening_hours, booking_rules, ${BILLING_COLUMNS}`,
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
        initialTab={tab}
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
