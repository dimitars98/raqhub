import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyClub } from "@/lib/myClub";
import { BILLING_COLUMNS, clubAccess, type ClubBilling } from "@/lib/plans";
import { UpgradeNotice } from "@/components/admin/PlanNotices";
import GroupsClient, { type GroupCard } from "@/components/groups/GroupsClient";
import { HOLDS_PLACE, monthOf } from "@/lib/groups";
import type { Group, GroupPlayerStatus } from "@/types/database";

export default async function AdminGroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { club } = await getMyClub<{ id: string; name: string } & ClubBilling>(
    supabase,
    user.id,
    `id, name, ${BILLING_COLUMNS}`,
  );
  if (!club) redirect("/admin/setup");
  if (!clubAccess(club).has("groups")) return <UpgradeNotice feature="groups" />;

  const { data: groupsData } = await supabase
    .from("groups")
    .select("*, coach:coaches(profile:profiles(full_name)), court:courts(name)")
    .eq("club_id", club.id)
    .order("name");
  const groups = (groupsData ?? []) as unknown as (Group & {
    coach: { profile: { full_name: string | null } | null } | null;
    court: { name: string } | null;
  })[];
  const ids = groups.map((g) => g.id);

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const month = monthOf(now);

  const [{ data: players }, { data: sessions }] = ids.length
    ? await Promise.all([
        supabase
          .from("group_players")
          .select("id, group_id, status, joined_on")
          .in("group_id", ids)
          .neq("status", "left"),
        supabase
          .from("group_sessions")
          .select("id, group_id, starts_at")
          .in("group_id", ids)
          .eq("status", "scheduled")
          .gt("starts_at", now.toISOString())
          .order("starts_at")
          .limit(2000),
      ])
    : [{ data: [] }, { data: [] }];

  const activeIds = (players ?? []).filter((p) => p.status === "active").map((p) => p.id);
  const { data: fees } = activeIds.length
    ? await supabase.from("group_fees").select("player_id").eq("month", month).in("player_id", activeIds)
    : { data: [] };
  const paid = new Set((fees ?? []).map((f) => f.player_id));

  // Drop-in groups: how many booked the next session.
  const nextByGroup = new Map<string, { id: string; starts_at: string }>();
  for (const s of sessions ?? []) if (!nextByGroup.has(s.group_id)) nextByGroup.set(s.group_id, s);
  const dropinNext = groups
    .filter((g) => g.kind === "dropin")
    .map((g) => nextByGroup.get(g.id)?.id)
    .filter(Boolean) as string[];
  const { data: booked } = dropinNext.length
    ? await supabase.from("group_attendance").select("session_id, status").in("session_id", dropinNext)
    : { data: [] };

  const cards: GroupCard[] = groups.map((g) => {
    const mine = (players ?? []).filter((p) => p.group_id === g.id);
    const next = nextByGroup.get(g.id) ?? null;
    const inSeason = g.starts_on <= `${month.slice(0, 8)}31` && g.ends_on >= month;
    return {
      id: g.id,
      name: g.name,
      kind: g.kind,
      sport: g.sport,
      level: g.level,
      age_min: g.age_min,
      age_max: g.age_max,
      adults: g.adults,
      days: g.days,
      start_time: g.start_time,
      end_time: g.end_time,
      max_players: g.max_players,
      price: g.price,
      archived_at: g.archived_at,
      coach_id: g.coach_id,
      coachName: g.coach?.profile?.full_name ?? null,
      courtName: g.court?.name ?? null,
      taken:
        g.kind === "dropin"
          ? (booked ?? []).filter((b) => b.session_id === next?.id && b.status !== "excused").length
          : mine.filter((p) => HOLDS_PLACE.includes(p.status as GroupPlayerStatus)).length,
      waiting: mine.filter((p) => p.status === "waiting").length,
      requests: mine.filter((p) => p.status === "requested").length,
      unpaid:
        g.kind === "season" && !g.archived_at && inSeason && Number(g.price) > 0
          ? mine.filter((p) => p.status === "active" && !paid.has(p.id)).length
          : 0,
      next: next?.starts_at ?? null,
      sessionsThisWeek: (sessions ?? []).filter(
        (s) => s.group_id === g.id && new Date(s.starts_at) < weekEnd,
      ).length,
    };
  });

  return <GroupsClient groups={cards} clubName={club.name} month={month} />;
}
