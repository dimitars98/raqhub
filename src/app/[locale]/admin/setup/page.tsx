import { redirect } from "next/navigation";
import CreateClubForm from "@/components/admin/CreateClubForm";
import { createClient } from "@/lib/supabase/server";

export default async function ClubSetupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Someone who already has a club has nothing to set up.
  const { data: existing } = await supabase
    .from("clubs")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) redirect("/admin/timetable");

  return <CreateClubForm ownerId={user.id} defaultEmail={user.email ?? ""} />;
}
