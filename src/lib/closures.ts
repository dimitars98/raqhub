// Closing courts (supabase/migrations/20261027_court_closures.sql): a club
// closes some or all of its courts for a while. Nobody can book them then,
// and the bookings already in that time are cancelled, with the reason.

export const CLOSURE_REASONS = ["maintenance", "weather", "tournament", "event", "holiday", "other"] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export type Closure = {
  id: string;
  /** Null: every court of the club. */
  court_ids: string[] | null;
  starts_at: string;
  ends_at: string;
  reason: ClosureReason;
  note: string | null;
};

/** What the club's public page shows (no note: it can be internal). */
export type PublicClosure = {
  starts_at: string;
  ends_at: string;
  reason: ClosureReason;
  /** Court names; null: the whole club. */
  courts: string[] | null;
};

export const CLOSURE_COLUMNS = "id, court_ids, starts_at, ends_at, reason, note";

export const isReason = (v: unknown): v is ClosureReason =>
  typeof v === "string" && (CLOSURE_REASONS as readonly string[]).includes(v);

/** Does this closure close this court? */
export const closes = (c: Pick<Closure, "court_ids">, courtId: string) =>
  c.court_ids === null || c.court_ids.includes(courtId);

/** The closures that touch this court on the day starting at dayStart (local midnight). */
export function closuresOnDay<T extends Closure>(closures: T[], courtId: string, dayStart: Date) {
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return closures.filter(
    (c) => closes(c, courtId) && new Date(c.starts_at) < dayEnd && new Date(c.ends_at) > dayStart,
  );
}

// Times are shown in the club's time zone, so the server and the browser
// (and every visitor) write the same thing.
const TZ = "Europe/Skopje";

function clock(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {});
  return `${p.hour}:${p.minute}`;
}

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

/** True when a closure runs from midnight to midnight, possibly over several days. */
export function wholeDays(c: Pick<Closure, "starts_at" | "ends_at">) {
  return clock(new Date(c.starts_at)) === "00:00" && clock(new Date(c.ends_at)) === "00:00";
}

/** "Mon 27 Oct", "27 Oct – 2 Nov", "Mon 27 Oct, 09:00–21:00" or "27 Oct 18:00 – 28 Oct 10:00". */
export function closureWhen(c: Pick<Closure, "starts_at" | "ends_at">, intlLocale: string) {
  const s = new Date(c.starts_at);
  const e = new Date(c.ends_at);
  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale, { timeZone: TZ, ...opts });
  const weekday = fmt({ weekday: "short", day: "numeric", month: "short" });
  const short = fmt({ day: "numeric", month: "short" });
  const time = (d: Date) => clock(d);
  const endsAtMidnight = clock(e) === "00:00";
  const lastMoment = new Date(e.getTime() - 1);

  if (wholeDays(c)) {
    return dayKey(s) === dayKey(lastMoment)
      ? weekday.format(s)
      : `${short.format(s)} – ${short.format(lastMoment)}`;
  }
  if (dayKey(s) === dayKey(lastMoment)) {
    return `${weekday.format(s)}, ${time(s)}–${endsAtMidnight ? "24:00" : time(e)}`;
  }
  return `${short.format(s)} ${time(s)} – ${short.format(e)} ${time(e)}`;
}
