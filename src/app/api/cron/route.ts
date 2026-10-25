import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailProvider } from "@/lib/email/send";
import {
  Budget,
  sendBookingReminders,
  sendGroupFeeReminders,
  sendGroupOffers,
  sendNewClubNotices,
  sendRenewalReminders,
  sendTrialEmails,
  sendWeeklyReports,
} from "@/lib/automation/jobs";

// Called every hour by Supabase Cron (see supabase/cron_http_job.sql).
// Sends booking reminders, membership renewal reminders, free-trial emails
// to club owners, new-club emails to you and, on Monday mornings, the weekly
// report to club owners. Also makes the day's in-app notifications and gives
// back open match courts nobody filled. Safe to call more often:
// nothing is ever sent twice.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EMAILS_PER_RUN = Number(process.env.EMAILS_PER_RUN ?? 40);

/** A readable message for the run summary. Database errors are plain objects, not Errors. */
function describe(e: unknown) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error("[cron]", e);
    return NextResponse.json({ error: describe(e) }, { status: 503 });
  }
  const budget = new Budget(EMAILS_PER_RUN);
  const result: Record<string, unknown> = { provider: emailProvider() };

  // Each job runs on its own, so one failing doesn't stop the others.
  for (const [name, job] of [
    ["reminders", sendBookingReminders],
    ["renewals", sendRenewalReminders],
    ["weeklyReports", sendWeeklyReports],
    ["trialEmails", sendTrialEmails],
    ["newClubs", sendNewClubNotices],
    ["groupOffers", sendGroupOffers],
    ["groupFees", sendGroupFeeReminders],
  ] as const) {
    try {
      result[name] = await job(db, budget);
    } catch (e) {
      console.error(`[cron] ${name} failed`, e);
      result[name] = { error: describe(e) };
    }
  }

  // In-app notifications: reminders, memberships and trials ending (no email budget).
  try {
    const { data, error } = await db.rpc("run_scheduled_notifications");
    result.notifications = error ? { error: error.message } : data;
  } catch (e) {
    console.error("[cron] notifications failed", e);
    result.notifications = { error: describe(e) };
  }

  // Open matches: ask organisers about courts that aren't full, give back the ones nobody kept.
  try {
    const { data, error } = await db.rpc("run_open_match_jobs");
    result.openMatches = error ? { error: error.message } : data;
  } catch (e) {
    console.error("[cron] open matches failed", e);
    result.openMatches = { error: describe(e) };
  }

  result.budgetLeft = budget.left;
  return NextResponse.json(result);
}
