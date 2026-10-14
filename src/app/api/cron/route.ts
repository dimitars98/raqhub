import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailProvider } from "@/lib/email/send";
import {
  Budget,
  sendBookingReminders,
  sendNewClubNotices,
  sendRenewalReminders,
  sendTrialEmails,
  sendWeeklyReports,
} from "@/lib/automation/jobs";

// Called every hour by Supabase Cron (see supabase/cron_http_job.sql).
// Sends booking reminders, membership renewal reminders, free-trial emails
// to club owners, new-club emails to you and, on Monday mornings, the weekly
// report to club owners. Safe to call more often:
// nothing is ever sent twice.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EMAILS_PER_RUN = Number(process.env.EMAILS_PER_RUN ?? 40);

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const budget = new Budget(EMAILS_PER_RUN);
  const result: Record<string, unknown> = { provider: emailProvider() };

  // Each job runs on its own, so one failing doesn't stop the others.
  for (const [name, job] of [
    ["reminders", sendBookingReminders],
    ["renewals", sendRenewalReminders],
    ["weeklyReports", sendWeeklyReports],
    ["trialEmails", sendTrialEmails],
    ["newClubs", sendNewClubNotices],
  ] as const) {
    try {
      result[name] = await job(db, budget);
    } catch (e) {
      console.error(`[cron] ${name} failed`, e);
      result[name] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  result.budgetLeft = budget.left;
  return NextResponse.json(result);
}
