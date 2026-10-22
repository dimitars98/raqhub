import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { RegisterGroup } from "@/components/groups/RegisterClient";
import type { DetailSession } from "@/components/groups/GroupClient";
import { monthOf } from "@/lib/groups";
import type { GroupAttendance, GroupPlayer, GroupSession } from "@/types/database";

// What the register needs for one session. Null when the session isn't in
// this group or the signed-in user may not see it.
export async function loadRegister(supabase: SupabaseClient<Database>, groupId: string, sessionId: string) {
  const [{ data: g }, { data: s }] = await Promise.all([
    supabase.from("groups").select("id, name, kind, max_players, price, court:courts(name)").eq("id", groupId).maybeSingle(),
    supabase.from("group_sessions").select("*, court:courts(name)").eq("id", sessionId).eq("group_id", groupId).maybeSingle(),
  ]);
  if (!g || !s) return null;

  const [{ data: players }, { data: attendance }, { data: all }] = await Promise.all([
    supabase.from("group_players").select("id, name, status, trial_session_id, monthly_price").eq("group_id", groupId).order("name"),
    supabase.from("group_attendance").select("id, player_id, guest_name, status, paid, reason").eq("session_id", sessionId),
    supabase.from("group_sessions").select("id, starts_at").eq("group_id", groupId).eq("status", "scheduled").order("starts_at"),
  ]);
  const marked = new Set((attendance ?? []).map((a) => a.player_id).filter(Boolean));
  // The list: everyone on it, a trial player on their trial day, and anyone
  // already marked for this session (e.g. who has since left).
  const list = ((players ?? []) as unknown as GroupPlayer[]).filter(
    (p) =>
      (g.kind === "season" &&
        (p.status === "active" || (p.status === "trial" && (!p.trial_session_id || p.trial_session_id === sessionId)))) ||
      marked.has(p.id),
  );

  const month = monthOf(s.starts_at);
  const active = list.filter((p) => p.status === "active").map((p) => p.id);
  const { data: fees } =
    active.length && Number(g.price) > 0 && g.kind === "season"
      ? await supabase.from("group_fees").select("player_id").eq("month", month).in("player_id", active)
      : { data: null };
  const paid = new Set((fees ?? []).map((f) => f.player_id));

  const sessionRow = s as unknown as GroupSession & { court: { name: string } | null };
  const index = (all ?? []).findIndex((x) => x.id === sessionId);
  return {
    group: {
      id: g.id,
      name: g.name,
      kind: g.kind as RegisterGroup["kind"],
      max_players: g.max_players,
      courtName: (g as unknown as { court: { name: string } | null }).court?.name ?? null,
    } satisfies RegisterGroup,
    session: { ...sessionRow, courtName: sessionRow.court?.name ?? null } as DetailSession,
    players: list,
    attendance: (attendance ?? []) as unknown as GroupAttendance[],
    unpaid: fees ? active.filter((id) => !paid.has(id)) : [],
    number: index + 1,
    total: (all ?? []).length,
  };
}
