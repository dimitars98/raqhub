// Small helpers for "club time" (Europe/Skopje), independent of the server's zone.

export const CLUB_TIME_ZONE = "Europe/Skopje";

/** yyyy-mm-dd, weekday (1 = Monday … 7 = Sunday) and hour, in club time. */
export function clubNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLUB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: weekdays.indexOf(get("weekday")) + 1,
    hour: Number(get("hour")),
  };
}

/** Adds days to a yyyy-mm-dd date. */
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The UTC moment of 00:00 club time on a yyyy-mm-dd date. */
export function clubMidnight(date: string) {
  const guess = new Date(`${date}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value; // e.g. "GMT+02:00"
  const match = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
  return new Date(guess.getTime() - minutes * 60_000);
}

/** The UTC moment of a club-time date and "HH:MM", e.g. ("2026-10-25", "17:00"). */
export function toUtc(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const offsetAt = (d: Date) => {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone: CLUB_TIME_ZONE,
      timeZoneName: "longOffset",
    })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value;
    const m = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  };
  // The offset where the result lands, not at the guess (matters on the days
  // the clocks change).
  const first = new Date(guess.getTime() - offsetAt(guess) * 60_000);
  return new Date(guess.getTime() - offsetAt(first) * 60_000);
}
