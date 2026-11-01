import { sendEmail } from "@/lib/email/send";
import { groupCancelledEmail, groupFeeEmail, groupOfferEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/email/bookings";
import { localeForCountry } from "@/lib/email/locale";
import { scheduleText } from "@/lib/groups";
import type { Group } from "@/types/database";

// Emails about coaching groups. Parents usually have no RaqHub account, so
// these go to the contact email on the coach's list, in the club's language.

export type GroupClub = {
  name: string;
  country: string | null;
  phone?: string | null;
  email?: string | null;
};

type Contact = { name: string | null; contact_name: string | null; email: string | null };

/** One email per address: a parent with two children gets one. */
function byEmail<T extends Contact>(rows: T[]) {
  const seen = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.email) continue;
    const key = r.email.toLowerCase();
    seen.set(key, [...(seen.get(key) ?? []), r]);
  }
  return seen;
}

export async function emailSessionCancelled(
  club: GroupClub,
  group: Pick<Group, "name">,
  session: { starts_at: string; ends_at: string },
  reason: string | null,
  contacts: Contact[],
) {
  const locale = localeForCountry(club.country);
  let sent = 0;
  for (const [to, rows] of byEmail(contacts)) {
    const email = groupCancelledEmail({
      locale,
      contactName: rows[0].contact_name ?? rows[0].name,
      playerName: rows.map((r) => r.name).filter(Boolean).join(", "),
      groupName: group.name,
      clubName: club.name,
      appUrl: appUrl(),
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      reason,
    });
    if (await sendEmail({ to, replyTo: club.email ?? null, ...email })) sent++;
  }
  return sent;
}

export type Offer = {
  name: string;
  contact_name: string | null;
  email: string | null;
  token: string;
  expires_at: string;
};

export async function emailOffers(
  club: GroupClub,
  group: Pick<Group, "name" | "days" | "start_time" | "end_time">,
  offers: Offer[],
) {
  const locale = localeForCountry(club.country);
  let sent = 0;
  for (const o of offers) {
    if (!o.email) continue;
    const email = groupOfferEmail({
      locale,
      contactName: o.contact_name ?? o.name,
      playerName: o.name,
      groupName: group.name,
      clubName: club.name,
      appUrl: appUrl(),
      token: o.token,
      expiresAt: o.expires_at,
      schedule: scheduleText(group, locale),
    });
    if (await sendEmail({ to: o.email, replyTo: club.email ?? null, ...email })) sent++;
  }
  return sent;
}

export async function emailFeeDue(
  club: GroupClub,
  groupName: string,
  month: string,
  player: Contact & { amount: number },
) {
  if (!player.email) return false;
  const email = groupFeeEmail({
    locale: localeForCountry(club.country),
    contactName: player.contact_name ?? player.name,
    playerName: player.name ?? "",
    groupName,
    clubName: club.name,
    appUrl: appUrl(),
    month,
    amount: player.amount,
    clubPhone: club.phone ?? null,
  });
  return sendEmail({ to: player.email, replyTo: club.email ?? null, ...email });
}
