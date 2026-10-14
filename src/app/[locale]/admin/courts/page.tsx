import { createClient } from "@/lib/supabase/server";
import type { Court, Club } from "@/types/database";
import CourtsClient from "@/components/admin/CourtsClient";
import { redirect } from "next/navigation";
import { BILLING_COLUMNS, clubAccess, type ClubBilling } from "@/lib/plans";

export default async function AdminCourtsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The club owned by the signed-in admin
  const { data: clubData } = await supabase
    .from("clubs")
    .select(`id, name, ${BILLING_COLUMNS}`)
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  const club = clubData as (Pick<Club, "id" | "name"> & ClubBilling) | null;
  if (!club) redirect("/admin/setup");

  const { data: courtsData } = await supabase
    .from("courts")
    .select("*")
    .eq("club_id", club.id)
    .order("created_at", { ascending: false });

  const courts = (courtsData ?? []) as Court[];

  return (
    <CourtsClient
      courts={courts}
      clubId={club.id}
      maxCourts={clubAccess(club).maxCourts}
    />
  );
}
