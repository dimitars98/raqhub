"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanId } from "@/lib/plans";
import { clubNow } from "@/lib/automation/time";
import { nextPaidUntil, type Period } from "@/lib/ownerBilling";

// Everything on the owner page. Each action checks again that the signed-in
// account is the super admin, then works with the service-role key, which
// is the only thing allowed to change a club's plan and payment dates.

type Result = { error?: "notAllowed" | "invalid" | "failed"; paidUntil?: string };

async function ownerDb() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return data?.role === "super_admin" ? createAdminClient() : null;
}

const isPlan = (p: unknown): p is PlanId => typeof p === "string" && p in PLANS;
const isDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const done = () => revalidatePath("/[locale]/admin/owner", "page");

/** Records a payment and moves the club's paid-until date on. */
export async function recordPayment(input: {
  clubId: string;
  plan: PlanId;
  period: Period;
  method: "bank" | "cash";
  amount: number;
}): Promise<Result> {
  const db = await ownerDb();
  if (!db) return { error: "notAllowed" };
  if (
    !isPlan(input.plan) ||
    (input.period !== "month" && input.period !== "year") ||
    (input.method !== "bank" && input.method !== "cash") ||
    !Number.isFinite(input.amount) ||
    input.amount < 0
  ) {
    return { error: "invalid" };
  }

  const { data: club } = await db
    .from("clubs")
    .select("id, trial_ends_at, paid_until")
    .eq("id", input.clubId)
    .maybeSingle();
  if (!club) return { error: "invalid" };

  const paidUntil = nextPaidUntil({
    today: clubNow().date,
    trialEndsOn: club.trial_ends_at ? clubNow(new Date(club.trial_ends_at)).date : null,
    paidUntil: club.paid_until,
    period: input.period,
  });

  const { error } = await db
    .from("clubs")
    .update({ plan: input.plan, paid_until: paidUntil })
    .eq("id", club.id);
  if (error) {
    console.error("[owner] recordPayment", error);
    return { error: "failed" };
  }
  const { error: logError } = await db.from("club_payments").insert({
    club_id: club.id,
    plan: input.plan,
    period: input.period,
    method: input.method,
    amount: Math.round(input.amount * 100) / 100,
    paid_until: paidUntil,
  });
  if (logError) console.error("[owner] payment log", logError);

  done();
  return { paidUntil };
}

export async function setPlan(clubId: string, plan: PlanId): Promise<Result> {
  const db = await ownerDb();
  if (!db) return { error: "notAllowed" };
  if (!isPlan(plan)) return { error: "invalid" };
  const { error } = await db.from("clubs").update({ plan }).eq("id", clubId);
  if (error) return { error: "failed" };
  done();
  return {};
}

/** For fixing mistakes: sets the paid-until date directly (null = not paid). */
export async function setPaidUntil(clubId: string, date: string | null): Promise<Result> {
  const db = await ownerDb();
  if (!db) return { error: "notAllowed" };
  if (date !== null && !isDate(date)) return { error: "invalid" };
  const { error } = await db.from("clubs").update({ paid_until: date }).eq("id", clubId);
  if (error) return { error: "failed" };
  done();
  return {};
}

/** Gives a club more free days, counted from today or from the current trial end. */
export async function extendTrial(clubId: string, days: number): Promise<Result> {
  const db = await ownerDb();
  if (!db) return { error: "notAllowed" };
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: "invalid" };
  const { data: club } = await db
    .from("clubs")
    .select("trial_ends_at")
    .eq("id", clubId)
    .maybeSingle();
  if (!club) return { error: "invalid" };
  const from = Math.max(Date.now(), club.trial_ends_at ? new Date(club.trial_ends_at).getTime() : 0);
  const { error } = await db
    .from("clubs")
    .update({ trial_ends_at: new Date(from + days * 86_400_000).toISOString() })
    .eq("id", clubId);
  if (error) return { error: "failed" };
  done();
  return {};
}
