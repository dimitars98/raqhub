// Kortello's own plans for clubs (not the membership plans a club sells).
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

export type ClubAccess = {
  plan: PlanId;
  /** trial: inside the free month · active: paid · unpaid: trial over, not paid */
  status: "trial" | "active" | "unpaid";
  trialDaysLeft: number;
  /** Null = no limit. */
  maxCourts: number | null;
  has: (feature: Feature) => boolean;
};

export function clubAccess(club: ClubBilling | null | undefined, now = new Date()): ClubAccess {
  const plan: PlanId =
    club?.plan === "starter" || club?.plan === "academy" ? club.plan : "club";
  const trialEnd = club?.trial_ends_at ? new Date(club.trial_ends_at) : null;
  const inTrial = !!trialEnd && trialEnd > now;
  // paid_until is a date: paid through the end of that day.
  const paid = !!club?.paid_until && new Date(`${club.paid_until}T23:59:59`) >= now;

  const status = inTrial ? "trial" : paid ? "active" : "unpaid";
  const limits = PLANS[plan];

  return {
    plan,
    status,
    trialDaysLeft: inTrial ? Math.ceil((trialEnd!.getTime() - now.getTime()) / 86_400_000) : 0,
    // Everything is unlocked during the trial.
    maxCourts: inTrial ? null : limits.maxCourts,
    has: (feature) => inTrial || limits.features.includes(feature),
  };
}

export const BILLING_COLUMNS = "plan, trial_ends_at, paid_until";

export const SALES_EMAIL = "support@kortello.com";
