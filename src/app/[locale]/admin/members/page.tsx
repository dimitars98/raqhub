import { createClient } from "@/lib/supabase/server";
import MembersClient, { type MemberWithPlan } from "@/components/admin/MembersClient";
import type { MembershipPlan } from "@/types/database";
import { redirect } from "next/navigation";

export default async function MembersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The club owned by the signed-in admin
  const { data: clubData } = await supabase
    .from("clubs")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  const club = clubData as { id: string } | null;
  if (!club) redirect("/admin/setup");

  const { data: membersData } = await supabase
    .from("members")
    .select("*, plan:membership_plans(id, name, price, billing_period)")
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });

  const { data: plansData } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("club_id", club.id)
    .order("price");

  const members = (membersData ?? []) as MemberWithPlan[];
  const plans = (plansData ?? []) as MembershipPlan[];

  return <MembersClient members={members} plans={plans} clubId={club.id} />;
}
