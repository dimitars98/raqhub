import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { dateLocale } from "@/lib/dateLocale";
import { subDays, subMonths, subYears, format, startOfDay } from "date-fns";
import AnalyticsClient, { type AnalyticsData } from "./AnalyticsClient";
import { BILLING_COLUMNS, clubAccess } from "@/lib/plans";
import { UpgradeNotice } from "@/components/admin/PlanNotices";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cast<T>(q: any): Promise<{ data: T | null; error: unknown }> {
  return q;
}

type RawBooking = {
  id: string;
  starts_at: string;
  status: string;
  total_price: number;
  duration_min: number;
  court: { id: string; name: string; sport: string } | null;
  member: { full_name: string } | null;
  walk_in_name: string | null;
};

type RawMember = {
  id: string;
  created_at: string | null;
  plan: { name: string } | null;
  ends_at: string | null;
};

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const tc = await getTranslations("common");
  const dfLocale = dateLocale(await getLocale());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: club } = await supabase
    .from("clubs")
    .select(`id, name, ${BILLING_COLUMNS}`)
    .eq("owner_id", user.id)
    .single();
  if (!club) redirect("/login");
  if (!clubAccess(club).has("analytics"))
    return <UpgradeNotice feature="analytics" />;

  // Fetch 1 year of bookings + all members
  const yearAgo = subYears(new Date(), 1).toISOString();

  const [{ data: bookings }, { data: members }] = await Promise.all([
    cast<RawBooking[]>(
      supabase
        .from("bookings")
        .select(
          "id, starts_at, status, total_price, duration_min, walk_in_name, court:courts!inner(id, name, sport, club_id), member:members(full_name)",
        )
        .eq("court.club_id", club.id)
        .gte("starts_at", yearAgo)
        .order("starts_at", { ascending: true }),
    ),
    cast<RawMember[]>(
      supabase
        .from("members")
        .select("id, created_at, ends_at, plan:membership_plans(name)")
        .eq("club_id", club.id),
    ),
  ]);

  const allBookings = bookings ?? [];
  const allMembers = members ?? [];

  // ── Revenue over time (daily, last 365 days) ──────────────────────────
  const revenueByDay: Record<string, number> = {};
  for (const b of allBookings) {
    if (b.status === "cancelled") continue;
    const day = format(new Date(b.starts_at), "yyyy-MM-dd");
    revenueByDay[day] = (revenueByDay[day] ?? 0) + b.total_price;
  }

  // ── Bookings by status ────────────────────────────────────────────────
  const bookingsByStatus: Record<string, number> = {};
  for (const b of allBookings) {
    bookingsByStatus[b.status] = (bookingsByStatus[b.status] ?? 0) + 1;
  }

  // ── Revenue by sport ──────────────────────────────────────────────────
  const revenueBySport: Record<string, number> = {};
  for (const b of allBookings) {
    if (b.status === "cancelled" || !b.court) continue;
    const sport = b.court.sport;
    revenueBySport[sport] = (revenueBySport[sport] ?? 0) + b.total_price;
  }

  // ── Court utilization (booking count per court) ───────────────────────
  const courtUtilization: Record<
    string,
    { name: string; count: number; revenue: number }
  > = {};
  for (const b of allBookings) {
    if (!b.court || b.status === "cancelled") continue;
    const id = b.court.id;
    if (!courtUtilization[id]) {
      courtUtilization[id] = { name: b.court.name, count: 0, revenue: 0 };
    }
    courtUtilization[id].count += 1;
    courtUtilization[id].revenue += b.total_price;
  }

  // ── Peak hours heatmap (day of week × hour of day) ────────────────────
  // 7 days × 15 hours (07:00–21:00)
  const peakHours: number[][] = Array.from({ length: 7 }, () =>
    Array(15).fill(0),
  );
  for (const b of allBookings) {
    if (b.status === "cancelled") continue;
    const d = new Date(b.starts_at);
    const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
    const hour = d.getHours();
    if (hour >= 7 && hour <= 21) {
      peakHours[dow][hour - 7] += 1;
    }
  }

  // ── Members by plan ───────────────────────────────────────────────────
  const membersByPlan: Record<string, number> = {};
  for (const m of allMembers) {
    const plan = m.plan?.name ?? tc("noPlan");
    membersByPlan[plan] = (membersByPlan[plan] ?? 0) + 1;
  }

  // ── Member growth (cumulative, monthly, last 12 months) ──────────────
  const now = new Date();
  const memberGrowth: { month: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = startOfDay(subMonths(now, i));
    const label = format(monthStart, "MMM", { locale: dfLocale });
    const count = allMembers.filter(
      (m) => m.created_at && new Date(m.created_at) <= monthStart,
    ).length;
    memberGrowth.push({ month: label, count });
  }

  // ── Expiring soon (next 30 days) ──────────────────────────────────────
  const in30 = subDays(now, -30).toISOString();
  const expiringSoon = allMembers.filter(
    (m) => m.ends_at && m.ends_at >= now.toISOString() && m.ends_at <= in30,
  ).length;

  // ── Summary KPIs ──────────────────────────────────────────────────────
  const totalRevenue = allBookings
    .filter((b) => b.status !== "cancelled")
    .reduce((s, b) => s + b.total_price, 0);

  const last30Start = subDays(now, 30).toISOString();
  const prev30Start = subDays(now, 60).toISOString();

  const rev30 = allBookings
    .filter((b) => b.status !== "cancelled" && b.starts_at >= last30Start)
    .reduce((s, b) => s + b.total_price, 0);

  const revPrev30 = allBookings
    .filter(
      (b) =>
        b.status !== "cancelled" &&
        b.starts_at >= prev30Start &&
        b.starts_at < last30Start,
    )
    .reduce((s, b) => s + b.total_price, 0);

  const revenueChange =
    revPrev30 === 0 ? null : ((rev30 - revPrev30) / revPrev30) * 100;

  const data: AnalyticsData = {
    totalRevenue,
    revenueChange,
    totalBookings: allBookings.length,
    activeMembers: allMembers.length,
    expiringSoon,
    revenueByDay,
    bookingsByStatus,
    revenueBySport,
    courtUtilization: Object.values(courtUtilization).sort(
      (a, b) => b.count - a.count,
    ),
    peakHours,
    membersByPlan,
    memberGrowth,
  };

  return <AnalyticsClient data={data} />;
}
