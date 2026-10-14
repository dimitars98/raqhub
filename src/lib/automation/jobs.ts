import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { sendEmail } from "@/lib/email/send";
import { localeForCountry } from "@/lib/email/locale";
import {
  bookingReminderEmail,
  membershipRenewalEmail,
  weeklyReportEmail,
} from "@/lib/email/templates";
import { appUrl, bookingEmailData, clubEmailOf, type BookingEmailRow } from "@/lib/email/bookings";
import { normalizeHours } from "@/lib/openingHours";
import { addDays, clubMidnight, clubNow } from "./time";
import { clubAccess, type ClubBilling } from "@/lib/plans";

type Db = SupabaseClient<Database>;

/**
 * Emails per hourly run, shared by all jobs. Keeps well inside the free
 * limits (Resend 100 a day, Gmail about 500 a day); what is left over goes
 * out in the next hour.
 */
export class Budget {
  constructor(public left: number) {}
  take() {
    if (this.left <= 0) return false;
    this.left -= 1;
    return true;
  }
}

/** Email address and name of a user account (service role only). */
async function accountOf(db: Db, userId: string) {
  const { data } = await db.auth.admin.getUserById(userId);
  const user = data?.user;
  if (!user?.email) return null;
  return { email: user.email, name: (user.user_metadata?.full_name as string | undefined) ?? null };
}

// ---------------------------------------------------------------------------
// 1. Reminder about 24 hours before a booking
// ---------------------------------------------------------------------------

/**
 * Confirmed bookings starting within 24 hours that haven't had a reminder.
 * Bookings made less than 3 hours before they start get none: the
 * confirmation email was enough.
 */
export async function sendBookingReminders(db: Db, budget: Budget, now = new Date()) {
  const in24h = new Date(now.getTime() + 24 * 3_600_000);
  const { data, error } = await db
    .from("bookings")
    .select(
      "id, player_id, created_at, reference, starts_at, ends_at, duration_min, total_price, locale, court:courts(name, club:clubs(name, email, plan, trial_ends_at, paid_until)), coach:coaches(profile:profiles(full_name), club:clubs(name, email, plan, trial_ends_at, paid_until)), member:members(full_name, email)",
    )
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gt("starts_at", now.toISOString())
    .lte("starts_at", in24h.toISOString())
    .order("starts_at")
    .limit(200);
  if (error) throw error;

  let sent = 0;
  let skipped = 0;
  for (const raw of data ?? []) {
    const row = raw as unknown as BookingEmailRow & {
      player_id: string | null;
      created_at: string | null;
      member: { full_name: string; email: string | null } | null;
      court: { club: ClubBilling | null } | null;
      coach: { club: ClubBilling | null } | null;
    };
    // Reminder emails come with the Club and Academy plans.
    const club = row.court?.club ?? row.coach?.club ?? null;
    const remindersOn = !club || clubAccess(club).has("reminders");
    const markDone = () =>
      db.from("bookings").update({ reminder_sent_at: new Date().toISOString() }).eq("id", row.id);

    const lastMinute =
      row.created_at &&
      new Date(row.starts_at).getTime() - new Date(row.created_at).getTime() < 3 * 3_600_000;

    const to = row.player_id
      ? await accountOf(db, row.player_id)
      : row.member?.email
        ? { email: row.member.email, name: row.member.full_name }
        : null;

    if (lastMinute || !to || !remindersOn) {
      await markDone();
      skipped++;
      continue;
    }
    if (!budget.take()) break;

    const email = bookingReminderEmail(bookingEmailData(row, to.name));
    if (await sendEmail({ to: to.email, replyTo: clubEmailOf(row), ...email })) {
      await markDone();
      sent++;
    }
  }
  return { sent, skipped };
}

// ---------------------------------------------------------------------------
// 2. "Your membership ends soon", 7 days before
// ---------------------------------------------------------------------------

export async function sendRenewalReminders(db: Db, budget: Budget, now = new Date()) {
  const today = clubNow(now).date;
  const { data, error } = await db
    .from("members")
    .select(
      "id, full_name, email, ends_at, plan:membership_plans(name), club:clubs(name, email, phone, country, plan, trial_ends_at, paid_until)",
    )
    .eq("status", "active")
    .is("renewal_reminder_sent_at", null)
    .not("email", "is", null)
    .gte("ends_at", today)
    .lte("ends_at", addDays(today, 7))
    .limit(200);
  if (error) throw error;

  let sent = 0;
  for (const raw of data ?? []) {
    const m = raw as unknown as {
      id: string;
      full_name: string;
      email: string;
      ends_at: string;
      plan: { name: string } | null;
      club: ({ name: string; email: string | null; phone: string | null; country: string | null } & ClubBilling) | null;
    };
    if (!m.club) continue;
    // Renewal reminders come with the Club and Academy plans. Marked as
    // handled so the same rows don't come back every hour.
    if (!clubAccess(m.club).has("reminders")) {
      await db
        .from("members")
        .update({ renewal_reminder_sent_at: new Date().toISOString() })
        .eq("id", m.id);
      continue;
    }
    if (!budget.take()) break;

    const email = membershipRenewalEmail({
      locale: localeForCountry(m.club.country),
      name: m.full_name,
      clubName: m.club.name,
      planName: m.plan?.name ?? null,
      endsAt: m.ends_at,
      clubEmail: m.club.email,
      clubPhone: m.club.phone,
    });
    if (await sendEmail({ to: m.email, replyTo: m.club.email, ...email })) {
      await db
        .from("members")
        .update({ renewal_reminder_sent_at: new Date().toISOString() })
        .eq("id", m.id);
      sent++;
    }
  }
  return { sent };
}

// ---------------------------------------------------------------------------
// 3. Weekly report to each club owner, Monday from 07:00 club time
// ---------------------------------------------------------------------------

const HOURS_PER_DAY = (from: string, to: string) => {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  return Math.max(0, (th * 60 + tm - (fh * 60 + fm)) / 60);
};

export async function sendWeeklyReports(db: Db, budget: Budget, now = new Date()) {
  const local = clubNow(now);
  if (local.weekday !== 1 || local.hour < 7) return { sent: 0, waiting: true };

  const weekStart = addDays(local.date, -7); // last Monday
  const from = clubMidnight(weekStart).toISOString();
  const to = clubMidnight(local.date).toISOString();

  const [{ data: clubs, error }, { data: done }] = await Promise.all([
    db
      .from("clubs")
      .select("id, name, country, owner_id, opening_hours, plan, trial_ends_at, paid_until")
      .eq("is_active", true)
      .not("owner_id", "is", null),
    db.from("club_weekly_reports").select("club_id").eq("week_start", weekStart),
  ]);
  if (error) throw error;
  const alreadySent = new Set((done ?? []).map((r) => r.club_id));

  let sent = 0;
  for (const club of clubs ?? []) {
    if (alreadySent.has(club.id) || !club.owner_id) continue;
    // The weekly report comes with the Club and Academy plans.
    if (!clubAccess(club).has("weeklyReport")) continue;
    const owner = await accountOf(db, club.owner_id);
    if (!owner) continue;
    if (!budget.take()) break;

    const [{ data: courts }, { data: coaches }] = await Promise.all([
      db.from("courts").select("id").eq("club_id", club.id).eq("is_active", true),
      db.from("coaches").select("id").eq("club_id", club.id),
    ]);
    const courtIds = (courts ?? []).map((c) => c.id);
    const coachIds = (coaches ?? []).map((c) => c.id);
    const filters = [
      courtIds.length ? `court_id.in.(${courtIds.join(",")})` : null,
      coachIds.length ? `coach_id.in.(${coachIds.join(",")})` : null,
    ].filter(Boolean);

    const bookings = filters.length
      ? (
          await db
            .from("bookings")
            .select("court_id, status, total_price, duration_min")
            .or(filters.join(","))
            .gte("starts_at", from)
            .lt("starts_at", to)
        ).data ?? []
      : [];

    const [{ count: newMembers }, { data: expiring }] = await Promise.all([
      db
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("club_id", club.id)
        .gte("created_at", from)
        .lt("created_at", to),
      db
        .from("members")
        .select("full_name, ends_at")
        .eq("club_id", club.id)
        .eq("status", "active")
        .gte("ends_at", local.date)
        .lte("ends_at", addDays(local.date, 14))
        .order("ends_at")
        .limit(8),
    ]);

    const played = bookings.filter((b) => b.status !== "cancelled");
    const paid = bookings.filter((b) => b.status === "confirmed" || b.status === "completed");
    const courtMinutes = played
      .filter((b) => b.court_id && b.status !== "no_show")
      .reduce((sum, b) => sum + b.duration_min, 0);
    const hours = normalizeHours(club.opening_hours);
    const openHoursPerCourt = hours.reduce(
      (sum, d) => sum + (d.open ? HOURS_PER_DAY(d.from, d.to) : 0),
      0,
    );
    const capacity = openHoursPerCourt * courtIds.length;

    const email = weeklyReportEmail({
      locale: localeForCountry(club.country),
      ownerName: owner.name,
      clubName: club.name,
      weekStart,
      bookings: played.length,
      revenue: paid.reduce((sum, b) => sum + Number(b.total_price), 0),
      occupancy: capacity > 0 ? Math.round((courtMinutes / 60 / capacity) * 100) : null,
      cancellations: bookings.filter((b) => b.status === "cancelled").length,
      noShows: bookings.filter((b) => b.status === "no_show").length,
      newMembers: newMembers ?? 0,
      expiring: (expiring ?? [])
        .filter((m) => m.ends_at)
        .map((m) => ({ name: m.full_name, endsAt: m.ends_at! })),
      appUrl: appUrl(),
    });

    if (await sendEmail({ to: owner.email, ...email })) {
      await db.from("club_weekly_reports").insert({ club_id: club.id, week_start: weekStart });
      sent++;
    }
  }
  return { sent, waiting: false };
}
