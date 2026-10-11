import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import DashboardShell from "@/components/layout/DashboardShell";

type Profile = { full_name: string | null; role: string };
type Club = { name: string };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  // 2. Create the client (ensure your lib/supabase/server.ts uses @supabase/ssr)
  const supabase = await createClient();

  // 3. Get the user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // 4. Fetch profile and club in parallel
  const [profileRes, clubRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single(),
    supabase.from("clubs").select("name").eq("owner_id", user.id).single(),
  ]);

  const profile = profileRes.data as Profile | null;
  const club = clubRes.data as Club | null;

  if (
    !profile ||
    (profile.role !== "club_admin" && profile.role !== "super_admin")
  ) {
    redirect(`/${locale}/login`);
  }

  return (
    <DashboardShell
      role="admin"
      userName={profile.full_name ?? "Admin"}
      clubName={club?.name}
    >
      {children}
    </DashboardShell>
  );
}
