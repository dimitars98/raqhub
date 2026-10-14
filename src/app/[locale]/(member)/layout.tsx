import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import DashboardShell from "@/components/layout/DashboardShell";
import type { Profile } from "@/types/database";

type LayoutProfile = Pick<Profile, "full_name" | "role">;

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = await getLocale();

  if (!user) redirect(`/${locale}/login`);

  const { data: profile } = (await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single()) as { data: LayoutProfile | null };

  if (!profile) redirect(`/${locale}/login`);

  if (profile.role === "club_admin" || profile.role === "super_admin") {
    redirect(`/${locale}/admin/dashboard`);
  }

  return (
    <DashboardShell role="member" userName={profile.full_name ?? "Player"}>
      {children}
    </DashboardShell>
  );
}
