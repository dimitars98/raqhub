import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import type {
  Profile,
  Member,
  MembershipPlan,
  Booking,
  Court,
  Coach,
} from "@/types/database";
import ProfileAvatarUpload from "@/components/profile/ProfileAvatarUpload";
import ProfileEditForm from "@/components/profile/ProfileEditForm";
import { User, CreditCard, Calendar, Clock, Trophy } from "lucide-react";
import SignOutButton from "@/components/profile/SignOutButton";

type MemberWithPlan = Member & { plan?: MembershipPlan | null };
type BookingWithJoins = Booking & {
  court?: Pick<Court, "name"> | null;
  coach?: { profile?: Pick<Profile, "full_name"> | null } | null;
};

const MEMBER_STATUS_STYLE: Record<string, string> = {
  active:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800",
  cancelled:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500",
  expired:
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700",
};

const BILLING_LABEL: Record<string, string> = {
  monthly: "/ month",
  annual: "/ year",
  one_time: "one-time",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileData }, { data: memberData }, { data: bookingsData }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      user.email
        ? supabase
            .from("members")
            .select("*, plan:membership_plans(*)")
            .eq("email", user.email)
            .eq("status", "active")
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("bookings")
        .select(
          "*, court:courts(name), coach:coaches(profile:profiles(full_name))",
        )
        .eq("player_id", user.id)
        .order("starts_at", { ascending: false }),
    ]);

  const profile = profileData as Profile | null;
  const member = memberData as MemberWithPlan | null;
  const bookings = (bookingsData ?? []) as BookingWithJoins[];

  // Stats
  const completedBookings = bookings.filter(
    (b) =>
      b.status === "completed" ||
      (new Date(b.starts_at) < new Date() && b.status !== "cancelled"),
  );
  const totalSessions = completedBookings.length;
  const totalMinutes = completedBookings.reduce(
    (acc, b) => acc + (b.duration_min ?? 0),
    0,
  );
  const totalHours = Math.round(totalMinutes / 60);
  const totalSpent = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((acc, b) => acc + (b.total_price ?? 0), 0);
  const upcomingCount = bookings.filter(
    (b) =>
      new Date(b.starts_at) >= new Date() &&
      (b.status === "confirmed" || b.status === "pending"),
  ).length;

  const initials = (name: string | null) =>
    (name ?? user.email ?? "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-medium text-brand-900">My profile</h1>
      </div>

      {/* Avatar + name card */}
      <div className="card px-5 py-5 mb-4 flex items-center gap-4">
        <ProfileAvatarUpload
          userId={user.id}
          avatarUrl={profile?.avatar_url ?? null}
          initials={initials(profile?.full_name ?? null)}
        />
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-brand-900 truncate">
            {profile?.full_name ?? "Your name"}
          </p>
          <p className="text-sm text-brand-400 truncate">{user.email}</p>
          {profile?.phone && (
            <p className="text-xs text-brand-400 mt-0.5">{profile.phone}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="card px-5 py-4 mb-4 grid grid-cols-4 divide-x divide-brand-100">
        <div className="flex flex-col items-center gap-0.5 pr-3">
          <span className="text-lg font-medium text-brand-900">
            {totalSessions}
          </span>
          <span className="text-[10px] text-brand-400 text-center">
            Sessions
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3">
          <span className="text-lg font-medium text-brand-900">
            {totalHours}h
          </span>
          <span className="text-[10px] text-brand-400 text-center">Played</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3">
          <span className="text-lg font-medium text-brand-900">
            {upcomingCount}
          </span>
          <span className="text-[10px] text-brand-400 text-center">
            Upcoming
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 pl-3">
          <span className="text-lg font-medium text-brand-900">
            €{totalSpent.toFixed(0)}
          </span>
          <span className="text-[10px] text-brand-400 text-center">Spent</span>
        </div>
      </div>

      {/* Membership card */}
      <section className="mb-4">
        <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-3">
          Membership
        </h2>
        {member ? (
          <div className="card px-5 py-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-brand-900">
                  {member.plan?.name ?? "Member"}
                </p>
                {member.plan && (
                  <p className="text-xs text-brand-400 mt-0.5">
                    €{member.plan.price}{" "}
                    {BILLING_LABEL[member.plan.billing_period]}
                    {member.plan.discount_pct > 0 && (
                      <span className="ml-2 text-brand-600 font-medium">
                        · {member.plan.discount_pct}% off bookings
                      </span>
                    )}
                  </p>
                )}
              </div>
              <span className={MEMBER_STATUS_STYLE[member.status] ?? ""}>
                {member.status}
              </span>
            </div>
            <div className="border-t border-brand-100 pt-3 flex items-center justify-between">
              <span className="text-xs text-brand-400">
                Member since{" "}
                <span className="text-brand-600 font-medium">
                  {format(new Date(member.starts_at), "MMM yyyy")}
                </span>
              </span>
              {member.ends_at && (
                <span className="text-xs text-brand-400">
                  Renews{" "}
                  <span className="text-brand-600 font-medium">
                    {format(new Date(member.ends_at), "d MMM yyyy")}
                  </span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="card px-5 py-4 text-center">
            <p className="text-sm text-brand-400 mb-1">No active membership</p>
            <p className="text-xs text-brand-300">
              Contact your club to get added to a plan.
            </p>
          </div>
        )}
      </section>

      {/* Edit profile */}
      <section className="mb-4">
        <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-3">
          Personal details
        </h2>
        <div className="card px-5 py-5">
          <ProfileEditForm
            userId={user.id}
            defaultValues={{
              full_name: profile?.full_name ?? "",
              phone: profile?.phone ?? "",
            }}
          />
        </div>
      </section>

      {/* Account */}
      <section>
        <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-3">
          Account
        </h2>
        <div className="card divide-y divide-brand-100 overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-brand-700">Email</span>
            <span className="text-sm text-brand-400 truncate max-w-[200px]">
              {user.email}
            </span>
          </div>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-brand-700">Member since</span>
            <span className="text-sm text-brand-400">
              {format(new Date(user.created_at), "MMMM yyyy")}
            </span>
          </div>
          <div className="px-5 py-3.5">
            <SignOutButton />
          </div>
        </div>
      </section>
    </div>
  );
}
