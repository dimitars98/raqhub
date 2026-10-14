import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getTranslations } from "next-intl/server";
import type {
  Profile,
  MyMembership,
  Booking,
  Court,
  Coach,
} from "@/types/database";
import ProfileAvatarUpload from "@/components/profile/ProfileAvatarUpload";
import ProfileEditForm from "@/components/profile/ProfileEditForm";
import { User, CreditCard, Calendar, Clock, Trophy } from "lucide-react";
import SignOutButton from "@/components/profile/SignOutButton";

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

const BILLING = ["monthly", "annual", "one_time"];
const MEMBER_STATUSES = ["active", "cancelled", "expired"];

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const t = await getTranslations("profilePage");
  const locale = await getLocale();
  const fmt = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, options).format(new Date(value));
  const billingLabel = (period: string) =>
    BILLING.includes(period) ? t(`billing.${period as "monthly"}`) : period;

  const [{ data: profileData }, { data: memberData }, { data: bookingsData }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      // The player's own memberships (the members table is club-only).
      supabase.rpc("my_memberships"),
      supabase
        .from("bookings")
        .select(
          "*, court:courts(name), coach:coaches(profile:profiles(full_name))",
        )
        .eq("player_id", user.id)
        .order("starts_at", { ascending: false }),
    ]);

  const profile = profileData as Profile | null;
  const member =
    ((memberData ?? []) as unknown as MyMembership[]).find(
      (m) => m.status === "active",
    ) ?? null;
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
        <h1 className="text-2xl font-medium text-brand-900">{t("title")}</h1>
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
            {profile?.full_name ?? t("yourName")}
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
            {t("sessions")}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3">
          <span className="text-lg font-medium text-brand-900">
            {totalHours}h
          </span>
          <span className="text-[10px] text-brand-400 text-center">{t("played")}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-3">
          <span className="text-lg font-medium text-brand-900">
            {upcomingCount}
          </span>
          <span className="text-[10px] text-brand-400 text-center">
            {t("upcoming")}
          </span>
        </div>
        <div className="flex flex-col items-center gap-0.5 pl-3">
          <span className="text-lg font-medium text-brand-900">
            €{totalSpent.toFixed(0)}
          </span>
          <span className="text-[10px] text-brand-400 text-center">{t("spent")}</span>
        </div>
      </div>

      {/* Membership card */}
      <section className="mb-4">
        <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-3">
          {t("membership")}
        </h2>
        {member ? (
          <div className="card px-5 py-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-brand-900">
                  {member.plan?.name ?? t("member")}
                </p>
                {member.plan && (
                  <p className="text-xs text-brand-400 mt-0.5">
                    €{member.plan.price}{" "}
                    {billingLabel(member.plan.billing_period)}
                    {member.plan.discount_pct > 0 && (
                      <span className="ml-2 text-brand-600 font-medium">
                        · {t("discount", { pct: member.plan.discount_pct })}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <span className={MEMBER_STATUS_STYLE[member.status] ?? ""}>
                {MEMBER_STATUSES.includes(member.status)
                  ? t(`memberStatus.${member.status as "active"}`)
                  : member.status}
              </span>
            </div>
            <div className="border-t border-brand-100 pt-3 flex items-center justify-between">
              <span className="text-xs text-brand-400">
                {t("memberSince")}{" "}
                <span className="text-brand-600 font-medium">
                  {fmt(member.starts_at, { month: "short", year: "numeric" })}
                </span>
              </span>
              {member.ends_at && (
                <span className="text-xs text-brand-400">
                  {t("renews")}{" "}
                  <span className="text-brand-600 font-medium">
                    {fmt(member.ends_at, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="card px-5 py-4 text-center">
            <p className="text-sm text-brand-400 mb-1">{t("noMembership")}</p>
            <p className="text-xs text-brand-300">
              {t("noMembershipHint")}
            </p>
          </div>
        )}
      </section>

      {/* Edit profile */}
      <section className="mb-4">
        <h2 className="text-xs font-medium text-brand-400 uppercase tracking-widest mb-3">
          {t("personalDetails")}
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
          {t("account")}
        </h2>
        <div className="card divide-y divide-brand-100 overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-brand-700">{t("email")}</span>
            <span className="text-sm text-brand-400 truncate max-w-[200px]">
              {user.email}
            </span>
          </div>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-brand-700">{t("accountSince")}</span>
            <span className="text-sm text-brand-400">
              {fmt(user.created_at, { month: "long", year: "numeric" })}
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
