import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import DashboardShell from "@/components/layout/DashboardShell";
import type { Profile } from "@/types/database";
import { acceptStaffInvites } from "@/lib/myClub";
import { homeFor, usesAdminArea } from "@/lib/roles";

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

  if (usesAdminArea(profile.role)) redirect(`/${locale}${homeFor(profile.role)}`);

  // A player who is also staff of a club gets a link to its admin screens.
  const isStaff = !!(await acceptStaffInvites(supabase));

  return (
    <DashboardShell
      role="member"
      userId={user.id}
      userName={profile.full_name ?? "Player"}
      staffLink={isStaff}
    >
      {children}
    </DashboardShell>
  );
}
