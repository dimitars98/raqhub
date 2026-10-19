import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BILLING_COLUMNS, clubAccess } from "@/lib/plans";
import { UpgradeNotice } from "@/components/admin/PlanNotices";
import StaffClient, { type StaffRow } from "@/components/admin/StaffClient";
import type { ClubStaff } from "@/types/database";

export default async function StaffPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Owner only: staff have no club of their own and end up on their screens.
  const { data: club } = await supabase
    .from("clubs")
    .select(`id, ${BILLING_COLUMNS}`)
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!club) redirect("/admin/setup");
  if (!clubAccess(club).has("staff")) return <UpgradeNotice feature="staff" />;

  const { data } = await supabase
    .from("club_staff")
    .select("*")
    .eq("club_id", club.id)
    .order("created_at");
  const staff = (data ?? []) as ClubStaff[];

  // Names of the people who have already signed in.
  const ids = staff.map((s) => s.user_id).filter((id): id is string => !!id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const rows: StaffRow[] = staff.map((s) => ({
    id: s.id,
    email: s.email,
    name: s.user_id ? (nameOf.get(s.user_id) ?? null) : null,
    active: !!s.user_id,
    since: s.accepted_at ?? s.created_at,
  }));

  return <StaffClient staff={rows} />;
}
