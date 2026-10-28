// Shared by the server and the booking screens (no secrets here).

/** club: pay at the club · online: pay when booking · either: the player picks */
export type PayMode = "club" | "online" | "either";

/** Minutes a court is held while the player pays (Stripe's shortest checkout + 1). */
export const PAY_WINDOW_MIN = 31;

/** How a club takes payment right now: "club" until its Stripe account is ready. */
export function payModeOf(
  club: { payment_mode?: string | null; stripe_charges_enabled?: boolean | null } | null | undefined,
): PayMode {
  if (!club?.stripe_charges_enabled) return "club";
  return club.payment_mode === "online" || club.payment_mode === "either" ? club.payment_mode : "club";
}
