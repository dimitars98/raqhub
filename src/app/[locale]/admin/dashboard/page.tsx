import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  subWeeks,
  format,
} from "date-fns";
import DashboardClient from "./DashboardClient";

export type TodayBooking = {
  id: string;
  status: string;
  total_price: number;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  walk_in_name: string | null;
  member: { full_name: string } | null;
  court: { id: string; name: string } | null;
};

export type RecentBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  total_price: number;
  walk_in_name: string | null;
  reference: string;
  duration_min: number;
  member: { full_name: string } | null;
  court: { id: string; name: string } | null;
};

export type ActiveMember = {
  id: string;
  full_name: string;
  status: string;
  created_at: string | null;
  plan: { name: string } | null;
};

export type CourtRow = {
  id: string;
  name: string;
  sport: string;
  surface: string;
  is_indoor: boolean | null;
  is_active: boolean | null;
};

type WeekBooking = { id: string; total_price: number; starts_at: string };
type PrevWeekBooking = { id: string; total_price: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cast<T>(q: any): Promise<{ data: T | null; error: unknown }> {
  return q;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!club) redirect("/admin/setup");

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const prevWeekStart = startOfWeek(subWeeks(now, 1), {
    weekStartsOn: 1,
  }).toISOString();
  const prevWeekEnd = endOfWeek(subWeeks(now, 1), {
    weekStartsOn: 1,
  }).toISOString();

  const [
    { data: todayBookings },
    { data: weekBookings },
    { data: prevWeekBookings },
    { data: activeMembers },
    { data: courts },
    { data: recentBookings },
  ] = await Promise.all([
    cast<TodayBooking[]>(
      supabase
        .from("bookings")
        .select(
          "id, status, total_price, starts_at, ends_at, duration_min, walk_in_name, member:members(full_name), court:courts!inner(id, name, club_id)",
        )
        .eq("court.club_id", club.id)
        .gte("starts_at", todayStart)
        .lte("starts_at", todayEnd)
        .neq("status", "cancelled"),
    ),

    cast<WeekBooking[]>(
      supabase
        .from("bookings")
        .select("id, total_price, starts_at, court:courts!inner(id, club_id)")
        .eq("court.club_id", club.id)
        .gte("starts_at", weekStart)
        .lte("starts_at", weekEnd)
        .neq("status", "cancelled"),
    ),

    cast<PrevWeekBooking[]>(
      supabase
        .from("bookings")
        .select("id, total_price, court:courts!inner(id, club_id)")
        .eq("court.club_id", club.id)
        .gte("starts_at", prevWeekStart)
        .lte("starts_at", prevWeekEnd)
        .neq("status", "cancelled"),
    ),

    cast<ActiveMember[]>(
      supabase
        .from("members")
        .select(
          "id, full_name, status, created_at, plan:membership_plans(name)",
        )
        .eq("club_id", club.id)
        .eq("status", "active"),
    ),

    cast<CourtRow[]>(
      supabase
        .from("courts")
        .select("id, name, sport, surface, is_indoor, is_active")
        .eq("club_id", club.id)
        .eq("is_active", true),
    ),

    cast<RecentBooking[]>(
      supabase
        .from("bookings")
        .select(
          "id, starts_at, ends_at, status, total_price, walk_in_name, reference, duration_min, member:members(full_name), court:courts!inner(id, name, club_id)",
        )
        .eq("court.club_id", club.id)
        .order("created_at", { ascending: false })
        .limit(8),
    ),
  ]);

  const revByDay: Record<string, number> = {};
  for (const b of weekBookings ?? []) {
    const day = format(new Date(b.starts_at), "EEE");
    revByDay[day] = (revByDay[day] ?? 0) + b.total_price;
  }

  const thisWeekRevenue = (weekBookings ?? []).reduce(
    (s, b) => s + b.total_price,
    0,
  );
  const prevWeekRevenue = (prevWeekBookings ?? []).reduce(
    (s, b) => s + b.total_price,
    0,
  );
  const revenueChange =
    prevWeekRevenue === 0
      ? null
      : ((thisWeekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100;

  return (
    <DashboardClient
      clubName={club.name}
      todayBookings={todayBookings ?? []}
      thisWeekRevenue={thisWeekRevenue}
      revenueChange={revenueChange}
      revByDay={revByDay}
      activeMembers={activeMembers ?? []}
      courts={courts ?? []}
      recentBookings={recentBookings ?? []}
    />
  );
}
