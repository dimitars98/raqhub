import type { SupabaseClient } from "@supabase/supabase-js";

// The club the signed-in user works on: the club they own, or the club they
// are staff of (supabase/migrations/20261020_staff.sql).
//
// Only the timetable, bookings and members screens use this. Every other
// admin page looks up the club by owner, so staff can't open them.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

export async function getMyClub<T extends { id: string }>(
  supabase: AnyClient,
  userId: string,
  columns: string,
): Promise<{ club: T | null; isStaff: boolean }> {
  const { data: owned } = await supabase
    .from("clubs")
    .select(columns)
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (owned) return { club: owned as unknown as T, isStaff: false };

  const { data: staffClubId } = await supabase.rpc("my_staff_club");
  if (!staffClubId) return { club: null, isStaff: false };

  const { data: club } = await supabase
    .from("clubs")
    .select(columns)
    .eq("id", staffClubId as string)
    .maybeSingle();
  return { club: (club as unknown as T) ?? null, isStaff: !!club };
}

/**
 * Links any open staff invites for the user's confirmed email to their
 * account, and returns the club they are staff of (or null).
 */
export async function acceptStaffInvites(supabase: AnyClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("accept_staff_invites");
  // Before the staff migration has run, the function doesn't exist yet.
  if (error) return null;
  return (data as string | null) ?? null;
}
