import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { dateLocale } from "@/lib/dateLocale";
import type {
  Group,
  GroupKind,
  GroupLevel,
  GroupPlayer,
  GroupPlayerStatus,
} from "@/types/database";

// Coaching groups (supabase/migrations/20261024_groups.sql): shared helpers
// for the admin screens, the coach's register and the player side.

export const GROUP_KINDS: GroupKind[] = ["season", "dropin"];
export const GROUP_LEVELS: GroupLevel[] = ["beginner", "intermediate", "advanced", "all"];
/** ISO weekdays, Monday first. */
export const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];

/** Group times and dates are the club's local time. */
export const GROUP_TIME_ZONE = "Europe/Skopje";

/** Players who hold a place in a season group. */
export const HOLDS_PLACE: GroupPlayerStatus[] = ["active", "trial", "offered"];
/** Players on the list the coach works with. */
export const ON_LIST: GroupPlayerStatus[] = ["active", "trial"];

export const hhmm = (time: string) => time.slice(0, 5);

// Dates are formatted with date-fns, not Intl: the server and the browser
// must print exactly the same text, and their Intl data can differ.

/** "Tue", "Tuesday" … in the page's language. 1 = Monday. */
export function weekdayName(iso: number, locale: string, width: "short" | "long" = "short") {
  // 1 January 2024 was a Monday.
  return format(new Date(2024, 0, iso, 12), width === "short" ? "EEE" : "EEEE", { locale: dateLocale(locale) });
}

/** "Tue & Thu", "Mon, Wed, Thu" */
export function daysText(days: number[], locale: string, width: "short" | "long" = "short") {
  const names = [...days].sort((a, b) => a - b).map((d) => weekdayName(d, locale, width));
  return names.length === 2 ? names.join(" & ") : names.join(", ");
}

/** "Tue & Thu · 17:00–18:30" */
export function scheduleText(g: Pick<Group, "days" | "start_time" | "end_time">, locale: string) {
  return `${daysText(g.days, locale)} · ${hhmm(g.start_time)}–${hhmm(g.end_time)}`;
}

// Languages that write the day as "22." ("22. Okt.").
const DOTTED_DAY = ["de", "sr"];

/**
 * A moment in the club's time zone, from Intl-style options:
 * { weekday: "short", day: "numeric", month: "short" } → "Thu, 22 Oct".
 */
export function clubFormat(value: string | Date, locale: string, options: Intl.DateTimeFormatOptions) {
  const day = DOTTED_DAY.includes(locale) ? "do" : "d";
  const date = [
    options.day ? day : null,
    options.month === "long" ? "MMMM" : options.month ? "MMM" : null,
    options.year ? "yyyy" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const weekday = options.weekday === "long" ? "EEEE" : options.weekday ? "EEE" : null;
  const time = options.hour || options.minute ? "HH:mm" : null;
  const pattern = [weekday, date || null, time].filter(Boolean).join(", ") || "d MMM yyyy";
  // A bare month name stands alone ("October"), not inside a date.
  const fixed = pattern === "MMMM" ? "LLLL" : pattern === "MMM" ? "LLL" : pattern;
  return formatInTimeZone(typeof value === "string" ? new Date(value) : value, GROUP_TIME_ZONE, fixed, {
    locale: dateLocale(locale),
  });
}

export const clubTime = (value: string | Date) =>
  formatInTimeZone(typeof value === "string" ? new Date(value) : value, GROUP_TIME_ZONE, "HH:mm");

/** yyyy-mm-dd of a moment, in the club's time zone. */
export const clubDay = (value: string | Date) =>
  formatInTimeZone(typeof value === "string" ? new Date(value) : value, GROUP_TIME_ZONE, "yyyy-MM-dd");

/** A local date ("2026-10-22") as a Date at noon, for formatting only. */
export const noon = (day: string) => new Date(`${day}T12:00:00Z`);

/** yyyy-mm-01 of the month a moment falls in, in the club's time zone. */
export const monthOf = (value: string | Date = new Date()) => `${clubDay(value).slice(0, 7)}-01`;

/** "October 2026", or just "October" */
export function monthName(month: string, locale: string, withYear = true) {
  return format(noon(month), withYear ? "LLLL yyyy" : "LLLL", { locale: dateLocale(locale) });
}

/** The months a season covers, as yyyy-mm-01. */
export function seasonMonths(startsOn: string, endsOn: string) {
  const out: string[] = [];
  let [y, m] = startsOn.split("-").map(Number);
  const [ey, em] = endsOn.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 24) break;
  }
  return out;
}

/** What a player pays: their own price, or the group's. */
export const feeFor = (player: Pick<GroupPlayer, "monthly_price">, group: Pick<Group, "price">) =>
  Number(player.monthly_price ?? group.price);

export const money = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** Places taken in a season group. */
export const placesTaken = (players: Pick<GroupPlayer, "status">[]) =>
  players.filter((p) => HOLDS_PLACE.includes(p.status)).length;

/** Who to write to about a player: their contact, or themselves. */
export const contactOf = (p: Pick<GroupPlayer, "contact_name" | "name">) => p.contact_name ?? p.name;

/** Sign-up link on the club's page. */
export const groupsAnchor = "groups";
