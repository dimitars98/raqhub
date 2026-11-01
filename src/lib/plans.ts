// RaqHub's own plans for clubs (not the membership plans a club sells).
//
// Keep the court limits in step with club_max_courts() in
// supabase/migrations/20261013_plans_trial.sql: the database enforces them,
// this file only shows them.

export type PlanId = "starter" | "club" | "academy";
export type Feature =
  | "membershipPlans"
  | "coaches"
  | "reminders"
  | "weeklyReport"
  | "analytics"
  | "staff"
  | "groups";

export const TRIAL_DAYS = 30;

/** Most courts an admin can add in one go. */
export const MAX_COURTS_AT_ONCE = 20;

export const PLANS: Record<
  PlanId,
  { priceMonthly: number; priceYearly: number; maxCourts: number | null; features: Feature[] }
> = {
  starter: {
    priceMonthly: 9,
    priceYearly: 90,
    maxCourts: 3,
    features: [],
  },
  club: {
    priceMonthly: 19,
    priceYearly: 190,
    maxCourts: 8,
    features: ["membershipPlans", "coaches", "groups", "reminders", "weeklyReport"],
  },
  academy: {
    priceMonthly: 45,
    priceYearly: 450,
    maxCourts: null,
    features: ["membershipPlans", "coaches", "groups", "reminders", "weeklyReport", "analytics", "staff"],
  },
};

/** The plan that unlocks a feature first, for "upgrade to …" messages. */
export function planFor(feature: Feature): PlanId {
  return PLANS.club.features.includes(feature) ? "club" : "academy";
}

export type ClubBilling = {
  plan?: string | null;
  trial_ends_at?: string | null;
  paid_until?: string | null;
};

/** Days after the trial (or the paid period) ends before the club becomes read-only. */
export const GRACE_DAYS = 3;

export type ClubAccess = {
  plan: PlanId;
  /**
   * trial: inside the free month · active: paid
   * grace: just ended, everything still works for GRACE_DAYS
   * locked: read-only, online booking paused (see 20261025_trial_lock.sql)
   */
  status: "trial" | "grace" | "active" | "locked";
  trialDaysLeft: number;
  /** Days until read-only, while in grace. */
  graceDaysLeft: number;
  /** Nothing can be added or changed; players can't book. */
  readOnly: boolean;
  /** Null = no limit. */
  maxCourts: number | null;
  has: (feature: Feature) => boolean;
};

const DAY = 86_400_000;

// Mirrors public.club_locked() in the database.
export function clubAccess(club: ClubBilling | null | undefined, now = new Date()): ClubAccess {
  const plan: PlanId =
    club?.plan === "starter" || club?.plan === "academy" ? club.plan : "club";
  const trialEnd = club?.trial_ends_at ? new Date(club.trial_ends_at) : null;
  // paid_until is a date: paid through the end of that day (UTC, like the database).
  const paidEnd = club?.paid_until ? new Date(new Date(`${club.paid_until}T00:00:00Z`).getTime() + DAY) : null;
  const inTrial = !!trialEnd && trialEnd > now;
  const paid = !!paidEnd && paidEnd > now;

  // Grace runs from whichever ended last.
  const ended = Math.max(trialEnd?.getTime() ?? 0, paidEnd?.getTime() ?? 0);
  const graceEnd = ended ? ended + GRACE_DAYS * DAY : 0;
  const inGrace = !inTrial && !paid && graceEnd > now.getTime();

  const status = inTrial ? "trial" : paid ? "active" : inGrace ? "grace" : "locked";
  const limits = PLANS[plan];
  // The grace days after the trial are still the trial: everything unlocked.
  const allOpen = inTrial || (inGrace && !paidEnd);

  return {
    plan,
    status,
    trialDaysLeft: inTrial ? Math.ceil((trialEnd!.getTime() - now.getTime()) / DAY) : 0,
    graceDaysLeft: inGrace ? Math.max(1, Math.ceil((graceEnd - now.getTime()) / DAY)) : 0,
    readOnly: status === "locked",
    maxCourts: allOpen ? null : limits.maxCourts,
    // A locked club can still open every page it had, to look at its data.
    has: (feature) => allOpen || limits.features.includes(feature),
  };
}

/** When the club becomes (or became) read-only: GRACE_DAYS after the trial or payment ran out. */
export function readOnlyFrom(club: ClubBilling): string {
  const trialEnd = club.trial_ends_at ? new Date(club.trial_ends_at).getTime() : 0;
  const paidEnd = club.paid_until ? new Date(`${club.paid_until}T00:00:00Z`).getTime() + DAY : 0;
  return new Date(Math.max(trialEnd, paidEnd) + GRACE_DAYS * DAY).toISOString();
}

export const BILLING_COLUMNS = "plan, trial_ends_at, paid_until";

/** Where clubs and players write to RaqHub: help, plans, invoices, legal questions. */
export const SUPPORT_EMAIL = "support@raqhub.com";
export const SALES_EMAIL = SUPPORT_EMAIL;
