import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { DetailAttendance, DetailGroup, DetailSession } from "@/components/groups/GroupClient";
import type { Group, GroupFee, GroupPlayer, GroupSession } from "@/types/database";

// Everything the group page shows, for the club (admin) and the coach. The
// database rules decide what each of them may read.
export async function loadGroupDetail(supabase: SupabaseClient<Database>, id: string) {
  const { data: groupRow } = await supabase
    .from("groups")
    .select("*, coach:coaches(profile_id, profile:profiles(full_name)), court:courts(name), club:clubs(name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!groupRow) return null;
  const g = groupRow as unknown as Group & {
    coach: { profile_id: string; profile: { full_name: string | null } | null } | null;
    court: { name: string } | null;
    club: { name: string; slug: string } | null;
  };

  const [{ data: players }, { data: sessions }, { data: attendance }, { data: fees }] = await Promise.all([
    supabase.from("group_players").select("*").eq("group_id", id).order("created_at"),
    supabase
      .from("group_sessions")
      .select("*, court:courts(name)")
      .eq("group_id", id)
      .order("starts_at")
      .limit(1000),
    supabase
      .from("group_attendance")
      .select("id, session_id, player_id, status, guest_name, paid, session:group_sessions!inner(group_id)")
      .eq("session.group_id", id)
      .limit(5000),
    supabase
      .from("group_fees")
      .select("*, player:group_players!inner(group_id)")
      .eq("player.group_id", id)
      .limit(5000),
  ]);

  const { coach, court, club, ...rest } = g;
  const group: DetailGroup = {
    ...(rest as Group),
    coachName: coach?.profile?.full_name ?? null,
    courtName: court?.name ?? null,
  };
  return {
    group,
    coachProfileId: coach?.profile_id ?? null,
    club,
    players: (players ?? []) as unknown as GroupPlayer[],
    sessions: ((sessions ?? []) as unknown as (GroupSession & { court: { name: string } | null })[]).map(
      ({ court: c, ...s }) => ({ ...s, courtName: c?.name ?? null }),
    ) as DetailSession[],
    attendance: ((attendance ?? []) as unknown as (DetailAttendance & { session: unknown })[]).map(
      ({ session: _s, ...a }) => {
        void _s;
        return a;
      },
    ),
    fees: ((fees ?? []) as unknown as (GroupFee & { player: unknown })[]).map(({ player: _p, ...f }) => {
      void _p;
      return f;
    }),
  };
}
