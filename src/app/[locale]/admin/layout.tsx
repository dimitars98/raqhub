import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import DashboardShell from "@/components/layout/DashboardShell";
import { PlanBanner, UpgradeNotice } from "@/components/admin/PlanNotices";
import { ReadOnlyProvider } from "@/components/admin/ReadOnly";
import { acceptStaffInvites } from "@/lib/myClub";
import { BILLING_COLUMNS, clubAccess, type ClubBilling } from "@/lib/plans";
import type { Club, Profile } from "@/types/database";
import { usesAdminArea } from "@/lib/roles";

type LayoutProfile = Pick<Profile, "full_name" | "role">;
type LayoutClub = Pick<Club, "name" | "slug"> & ClubBilling & {
  subscription_status?: string | null;
  subscription_ends?: boolean | null;
};

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

  // 4. Fetch profile and the club they own in parallel
  const [profileRes, clubRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("clubs")
      .select(`name, slug, subscription_status, subscription_ends, ${BILLING_COLUMNS}`)
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as LayoutProfile | null;
  let club = clubRes.data as LayoutClub | null;
  if (!profile) redirect(`/${locale}/login`);

  // Club owners and the app owner, as before. Anyone else gets in only as
  // staff of a club that invited them (and only on the timetable, bookings
  // and members screens, see src/lib/myClub.ts).
  const isAdmin = usesAdminArea(profile.role);
  let isStaff = false;
  if (!isAdmin) {
    const staffClubId = await acceptStaffInvites(supabase);
    if (!staffClubId) redirect(`/${locale}/book`);
    const { data } = await supabase
      .from("clubs")
      .select(`name, slug, subscription_status, subscription_ends, ${BILLING_COLUMNS}`)
      .eq("id", staffClubId)
      .maybeSingle();
    club = data as LayoutClub | null;
    if (!club) redirect(`/${locale}/book`);
    isStaff = true;
  }

  // Staff accounts come with the Academy plan (and the free trial).
  const access = clubAccess(club);
  const staffLocked = isStaff && !access.has("staff");
  // The app owner's own pages (owner page) are never read-only.
  const readOnly = !!club && access.readOnly && profile.role !== "super_admin";

  return (
    <DashboardShell
      role="admin"
      userId={user.id}
      userName={profile.full_name ?? "Admin"}
      clubName={club?.name}
      clubSlug={club?.slug}
      isSuperAdmin={profile.role === "super_admin"}
      isStaff={isStaff}
      // The plan and trial are the owner's business, not the staff's.
      notice={
        club ? (
          <PlanBanner
            access={access}
            staff={isStaff}
            // Paying by card already: the trial just runs into the paid plan.
            renewsOn={
              ["active", "trialing"].includes(club.subscription_status ?? "") && !club.subscription_ends
                ? club.paid_until
                : null
            }
          />
        ) : undefined
      }
    >
      <ReadOnlyProvider value={readOnly}>
        {staffLocked ? <UpgradeNotice feature="staff" /> : children}
      </ReadOnlyProvider>
    </DashboardShell>
  );
}
