import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NotificationsView from "@/components/notifications/NotificationsView";

export default async function MemberNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <NotificationsView userId={user.id} area="member" />;
}
