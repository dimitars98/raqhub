import type { DayHours, OpeningHours } from "@/types/database";

/** What a club gets until it sets its own hours (matches the database rule). */
export const DEFAULT_HOURS: OpeningHours = Array.from({ length: 7 }, () => ({
  open: true,
  from: "07:00",
  to: "22:00",
}));

/** Whole hours from 07:00 to 21:00: the rows of the timetable and the start
 * times staff can pick, matching the default 07:00–22:00 day. */
export const DAY_HOURS = Array.from({ length: 15 }, (_, i) => 7 + i);

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Turns whatever is stored in clubs.opening_hours into seven clean days. */
export function normalizeHours(raw: unknown): OpeningHours {
  if (!Array.isArray(raw) || raw.length !== 7) return DEFAULT_HOURS;
  return raw.map((d, i): DayHours => {
    const day = d as Partial<DayHours> | null;
    const from = typeof day?.from === "string" && TIME.test(day.from) ? day.from : DEFAULT_HOURS[i].from;
    const to = typeof day?.to === "string" && TIME.test(day.to) ? day.to : DEFAULT_HOURS[i].to;
    return { open: day?.open !== false, from, to };
  });
}

/** Checks hours typed in the settings form. Returns an error message or null. */
export function validateHours(hours: OpeningHours): string | null {
  if (!Array.isArray(hours) || hours.length !== 7) return "sevenDays";
  for (const d of hours) {
    if (!d.open) continue;
    if (!TIME.test(d.from) || !TIME.test(d.to)) return "timeFormat";
    if (d.from >= d.to) return "closeAfterOpen";
  }
  return null;
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Monday = 0 … Sunday = 6, for a date in the viewer's calendar. */
export const weekdayIndex = (date: Date) => (date.getDay() + 6) % 7;

/**
 * Whole-hour start times on `date` that fit `durationMin` inside the club's
 * hours. Empty when the club is closed that day.
 */
export function startHoursFor(
  hours: OpeningHours,
  date: Date,
  durationMin: number,
): number[] {
  const day = hours[weekdayIndex(date)];
  if (!day?.open) return [];
  const open = toMinutes(day.from);
  const close = toMinutes(day.to);
  const result: number[] = [];
  for (let h = Math.ceil(open / 60); h * 60 + durationMin <= close; h++) {
    result.push(h);
  }
  return result;
}
