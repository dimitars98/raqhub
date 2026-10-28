/** Who a booking is for: the club member, the player who booked online, or the name typed for a walk-in or group. */
export function bookingName(
  b: {
    member?: { full_name: string | null } | null;
    player?: { full_name: string | null } | null;
    walk_in_name?: string | null;
  },
  fallback: string,
) {
  return b.member?.full_name || b.player?.full_name || b.walk_in_name || fallback;
}
