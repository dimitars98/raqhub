// A club's booking rules, set in Settings > Booking Rules and stored in
// clubs.booking_rules. The database checks them on every booking a player
// makes or cancels (supabase/migrations/20261014_booking_rules.sql and
// 20261014b_no_shows.sql); this file only helps the screens show the right
// choices. Keep the defaults in step with those migrations.

export type BookingRules = {
  /** Booking lengths players may choose, in minutes. */
  durations: number[];
  /** How many days, counting today, players can book. */
  max_days_ahead: number;
  /** No cancelling online this many hours before the start. 0 = any time. */
  cancel_hours: number;
  /** Bookings per player per day at this club. 0 = no limit. */
  max_per_day: number;
  /** Online booking pauses after this many no-shows in 90 days. 0 = never. */
  max_no_shows: number;
};

/** Lengths a club can offer. */
export const DURATION_CHOICES = [30, 60, 90, 120] as const;
export const CANCEL_HOUR_CHOICES = [0, 2, 6, 12, 24, 48] as const;
export const PER_DAY_CHOICES = [0, 1, 2, 3, 4] as const;
export const NO_SHOW_CHOICES = [0, 2, 3, 5] as const;
/** No-shows older than this no longer count. */
export const NO_SHOW_DAYS = 90;
export const MAX_DAYS_AHEAD = 90;

export const DEFAULT_RULES: BookingRules = {
  durations: [60, 90, 120],
  max_days_ahead: 14,
  cancel_hours: 0,
  max_per_day: 0,
  max_no_shows: 0,
};

const int = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

/** Rules as stored (or null) → complete rules, with defaults for anything missing. */
export function normalizeRules(raw: unknown): BookingRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof BookingRules, unknown>>;
  const durations = Array.isArray(r.durations)
    ? (DURATION_CHOICES as readonly number[]).filter((d) => (r.durations as unknown[]).map(Number).includes(d))
    : DEFAULT_RULES.durations;
  return {
    durations: durations.length ? durations : DEFAULT_RULES.durations,
    max_days_ahead: int(r.max_days_ahead, DEFAULT_RULES.max_days_ahead),
    cancel_hours: int(r.cancel_hours, DEFAULT_RULES.cancel_hours),
    max_per_day: int(r.max_per_day, DEFAULT_RULES.max_per_day),
    max_no_shows: int(r.max_no_shows, DEFAULT_RULES.max_no_shows),
  };
}

/**
 * A problem with the rules an admin entered, as a key in the "settingsErrors"
 * messages, or null when they're fine.
 */
export function validateRules(r: BookingRules): string | null {
  if (!r.durations.length) return "durations";
  if (r.durations.some((d) => !(DURATION_CHOICES as readonly number[]).includes(d)))
    return "lengthUnavailable";
  if (!(r.max_days_ahead >= 1 && r.max_days_ahead <= MAX_DAYS_AHEAD))
    return "daysAhead";
  if (!(CANCEL_HOUR_CHOICES as readonly number[]).includes(r.cancel_hours))
    return "cancelDeadline";
  if (!(PER_DAY_CHOICES as readonly number[]).includes(r.max_per_day))
    return "perDay";
  if (!(NO_SHOW_CHOICES as readonly number[]).includes(r.max_no_shows))
    return "noShows";
  return null;
}

/** The moment before which no-shows no longer count. */
export function noShowCutoff(now = new Date()) {
  return new Date(now.getTime() - NO_SHOW_DAYS * 86_400_000);
}

/** Whether a player can still cancel this booking online. */
export function canCancel(startsAt: string | Date, rules: BookingRules, now = new Date()) {
  const start = new Date(startsAt).getTime();
  return start - rules.cancel_hours * 3_600_000 > now.getTime();
}
