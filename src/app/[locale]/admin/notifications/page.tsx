import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import NotificationsView from "@/components/notifications/NotificationsView";

export default async function AdminNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The owner also sees the staff switch and the plan line; staff don't.
  const { club, isStaff } = await getMyClub<{ id: string }>(supabase, user.id, "id");
  return <NotificationsView userId={user.id} area="admin" isOwner={!!club && !isStaff} />;
}
