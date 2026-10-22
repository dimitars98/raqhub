import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MyGroupsClient, {
  type CoachedGroup,
  type MyDropin,
  type MyPlace,
} from "@/components/groups/MyGroupsClient";
import { monthOf } from "@/lib/groups";
import type { Group, GroupPlayer, GroupSession } from "@/types/database";

type GroupWithNames = Group & {
  coach: { profile: { full_name: string | null } | null } | null;
  court: { name: string } | null;
  club: { name: string; slug: string; phone: string | null } | null;
};
const GROUP_SELECT =
  "*, coach:coaches(profile:profiles(full_name)), court:courts(name), club:clubs(name, slug, phone)";

export default async function MyGroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const now = new Date().toISOString();
  const month = monthOf();

  // ---- Groups this person coaches ------------------------------------------
  const { data: myCoaches } = await supabase.from("coaches").select("id").eq("profile_id", user.id);
  const coachIds = (myCoaches ?? []).map((c) => c.id);
  const { data: coachedRows } = coachIds.length
    ? await supabase.from("groups").select(GROUP_SELECT).in("coach_id", coachIds).is("archived_at", null).order("name")
    : { data: [] };
  const coachedGroups = (coachedRows ?? []) as unknown as GroupWithNames[];

  // ---- Places on lists (their own, or their children's) ---------------------
  // Only their own places: as a coach they can also read their groups' lists.
  const email = (user.email ?? "").toLowerCase();
  const { data: placeRows } = await supabase
    .from("group_players")
    .select("*")
    .neq("status", "left")
    .or(email ? `profile_id.eq.${user.id},email.eq.${email}` : `profile_id.eq.${user.id}`)
    .order("created_at");
  const places = (placeRows ?? []) as unknown as (GroupPlayer & { offer_token: string | null })[];
  const placeGroupIds = [...new Set(places.map((p) => p.group_id))];
  const { data: placeGroupRows } = placeGroupIds.length
    ? await supabase.from("groups").select(GROUP_SELECT).in("id", placeGroupIds)
    : { data: [] };
  const placeGroups = (placeGroupRows ?? []) as unknown as GroupWithNames[];

  // ---- Drop-in sessions they booked -----------------------------------------
  const { data: dropinRows } = await supabase
    .from("group_attendance")
    .select("id, session_id, guest_name, status, session:group_sessions!inner(id, starts_at, ends_at, status, group_id)")
    .is("player_id", null)
    .eq("profile_id", user.id)
    .gt("session.starts_at", now);
  const dropins = (dropinRows ?? []) as unknown as {
    id: string;
    session_id: string;
    guest_name: string | null;
    session: Pick<GroupSession, "id" | "starts_at" | "ends_at" | "status" | "group_id">;
  }[];
  const dropinGroupIds = [...new Set(dropins.map((d) => d.session.group_id))].filter(
    (id) => !placeGroupIds.includes(id),
  );
  const { data: dropinGroupRows } = dropinGroupIds.length
    ? await supabase.from("groups").select(GROUP_SELECT).in("id", dropinGroupIds)
    : { data: [] };
  const allGroups = [...placeGroups, ...((dropinGroupRows ?? []) as unknown as GroupWithNames[]), ...coachedGroups];
  const groupOf = (id: string) => allGroups.find((g) => g.id === id);

  // ---- Sessions, attendance, fees and the coach's notes -------------------
  const sessionGroupIds = [...new Set([...placeGroupIds, ...coachedGroups.map((g) => g.id)])];
  const [{ data: sessionRows }, { data: pastRows }] = sessionGroupIds.length
    ? await Promise.all([
        supabase
          .from("group_sessions")
          .select("*")
          .in("group_id", sessionGroupIds)
          .gt("ends_at", now)
          .order("starts_at")
          .limit(400),
        supabase
          .from("group_sessions")
          .select("id, group_id, starts_at, note")
          .in("group_id", placeGroupIds.length ? placeGroupIds : ["00000000-0000-0000-0000-000000000000"])
          .lt("starts_at", now)
          .eq("status", "scheduled")
          .not("note", "is", null)
          .order("starts_at", { ascending: false })
          .limit(50),
      ])
    : [{ data: [] }, { data: [] }];
  const sessions = (sessionRows ?? []) as unknown as GroupSession[];

  const placeIds = places.map((p) => p.id);
  const [{ data: attendanceRows }, { data: feeRows }, { data: counts }] = await Promise.all([
    placeIds.length
      ? supabase
          .from("group_attendance")
          .select("session_id, player_id, status, session:group_sessions!inner(starts_at)")
          .in("player_id", placeIds)
      : Promise.resolve({ data: [] }),
    placeIds.length
      ? supabase.from("group_fees").select("player_id, month, method").in("player_id", placeIds).eq("month", month)
      : Promise.resolve({ data: [] }),
    coachedGroups.length
      ? supabase
          .from("group_players")
          .select("group_id, status")
          .in("group_id", coachedGroups.map((g) => g.id))
          .in("status", ["active", "trial", "waiting", "requested"])
      : Promise.resolve({ data: [] }),
  ]);
  const attendance = (attendanceRows ?? []) as unknown as {
    session_id: string;
    player_id: string;
    status: string;
    session: { starts_at: string };
  }[];

  const names = (g: GroupWithNames) => ({
    coachName: g.coach?.profile?.full_name ?? null,
    courtName: g.court?.name ?? null,
    clubName: g.club?.name ?? "",
    clubSlug: g.club?.slug ?? "",
    clubPhone: g.club?.phone ?? null,
  });

  const coached: CoachedGroup[] = coachedGroups.map((g) => {
    const mine = (counts ?? []).filter((c) => c.group_id === g.id);
    return {
      group: g,
      ...names(g),
      players: mine.filter((c) => c.status === "active" || c.status === "trial").length,
      waiting: mine.filter((c) => c.status === "waiting" || c.status === "requested").length,
      next: sessions.filter((s) => s.group_id === g.id && s.status === "scheduled").slice(0, 1)[0] ?? null,
    };
  });

  const mine: MyPlace[] = places.flatMap((p) => {
    const g = groupOf(p.group_id);
    if (!g) return [];
    // Sessions so far where the coach marked them (or the parent said no).
    const marked = attendance.filter(
      (a) => a.player_id === p.id && a.status !== "booked" && a.session.starts_at < now,
    );
    return [
      {
        player: p,
        offerToken: p.offer_token,
        group: g,
        ...names(g),
        sessions: sessions.filter((s) => s.group_id === g.id).slice(0, 4),
        excused: attendance.filter((a) => a.player_id === p.id && a.status === "excused").map((a) => a.session_id),
        came: marked.filter((a) => a.status === "present").length,
        marked: marked.length,
        paidThisMonth: (feeRows ?? []).some((f) => f.player_id === p.id),
        lastNote: (pastRows ?? []).find((s) => s.group_id === g.id) ?? null,
      },
    ];
  });

  const booked: MyDropin[] = dropins
    .filter((d) => d.session.status === "scheduled")
    .flatMap((d) => {
      const g = groupOf(d.session.group_id);
      return g ? [{ id: d.id, session: d.session, name: d.guest_name, group: g, ...names(g) }] : [];
    })
    .sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at));

  return <MyGroupsClient coached={coached} places={mine} dropins={booked} month={month} />;
}
