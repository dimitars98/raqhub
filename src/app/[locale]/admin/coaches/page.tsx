import CoachesClient from "@/components/admin/CoachesClient";
import { createClient } from "@/lib/supabase/server";
import { Coach } from "@/types/database";
import { BILLING_COLUMNS, clubAccess, type ClubBilling } from "@/lib/plans";
import { UpgradeNotice } from "@/components/admin/PlanNotices";

export default async function CoachesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: club } = (await supabase
    .from("clubs")
    .select(`id, ${BILLING_COLUMNS}`)
    .eq("owner_id", user?.id ?? "")
    .single()) as { data: ({ id: string } & ClubBilling) | null };

  if (club && !clubAccess(club).has("coaches"))
    return <UpgradeNotice feature="coaches" />;

  const { data: coaches } = await supabase
    .from("coaches")
    .select(
      "*, profile:profiles(id, full_name, avatar_url, phone, role, stripe_customer_id, created_at, updated_at)",
    )
    .eq("club_id", club?.id ?? "")
    .order("created_at", { ascending: false });

  const normalizedCoaches = (coaches ?? []).map((c) => ({
    ...c,
    specializations: c.specializations ?? [],
    levels: c.levels ?? [],
  }));

  return (
    <CoachesClient
      coaches={normalizedCoaches as Coach[]}
      clubId={club?.id ?? ""}
    />
  );
}
