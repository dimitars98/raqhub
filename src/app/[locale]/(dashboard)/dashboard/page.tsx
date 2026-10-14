import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (data as Pick<Profile, "role"> | null)?.role;

  if (role === "club_admin" || role === "super_admin") {
    redirect("/admin/dashboard");
  } else {
    redirect("/my-bookings");
  }
}
