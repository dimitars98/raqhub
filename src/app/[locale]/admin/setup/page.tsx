import { redirect } from "next/navigation";
import CreateClubForm from "@/components/admin/CreateClubForm";
import { createClient } from "@/lib/supabase/server";
import { acceptStaffInvites } from "@/lib/myClub";

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

  // Staff work on someone else's club. Owner-only pages send them here
  // (they have no club of their own), and from here to their screens.
  if (await acceptStaffInvites(supabase)) redirect("/admin/timetable");

  return <CreateClubForm ownerId={user.id} defaultEmail={user.email ?? ""} />;
}
