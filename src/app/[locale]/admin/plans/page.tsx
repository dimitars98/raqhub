import { redirect } from "next/navigation";
import PlansClient from "@/components/admin/PlansClient";
import { createClient } from "@/lib/supabase/server";
import type { MembershipPlan, Club } from "@/types/database";

export default async function PlansPage() {
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
  const club = clubData as Pick<Club, "id"> | null;
  if (!club) redirect("/admin/setup");

  const { data: plansData } = await supabase
    .from("membership_plans")
    .select("*")
    .eq("club_id", club.id)
    .order("price");

  const plans = (plansData ?? []) as MembershipPlan[];

  return <PlansClient plans={plans} clubId={club.id} />;
}
