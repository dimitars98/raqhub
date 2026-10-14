import { pickLocale } from "./locale";
import type { BookingEmailData } from "./templates";

/** Columns (and joins) every booking email needs. */
export const BOOKING_EMAIL_SELECT =
  "id, reference, starts_at, ends_at, duration_min, total_price, locale, court:courts(name, club:clubs(name, email)), coach:coaches(profile:profiles(full_name), club:clubs(name, email))";

export type BookingEmailRow = {
  id: string;
  reference: string;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  total_price: number;
  locale: string | null;
  court: { name: string; club: { name: string; email: string | null } | null } | null;
  coach: {
    profile: { full_name: string | null } | null;
    club: { name: string; email: string | null } | null;
  } | null;
};

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** The club's email, so a player's reply goes to the club, not to ServeTime. */
export const clubEmailOf = (row: BookingEmailRow) =>
  row.court?.club?.email ?? row.coach?.club?.email ?? null;

export function bookingEmailData(
  row: BookingEmailRow,
  name: string | null,
  locale?: string | null,
): BookingEmailData {
  return {
    locale: pickLocale(locale ?? row.locale),
    name: name?.trim() || null,
    courtName: row.court?.name ?? null,
    coachName: row.coach?.profile?.full_name ?? null,
    clubName: row.court?.club?.name ?? row.coach?.club?.name ?? "ServeTime",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    durationMin: row.duration_min,
    totalPrice: row.total_price,
    reference: row.reference,
    appUrl: appUrl(),
  };
}
