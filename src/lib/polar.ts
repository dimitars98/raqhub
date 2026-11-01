import { createPolar } from "@polar-sh/sdk/2026-10";
import type { Period } from "@/lib/ownerBilling";
import type { PlanId } from "@/lib/plans";

// Polar sells the RaqHub plans to clubs as card subscriptions
// (supabase/migrations/20261029b_polar_subscriptions.sql). Server only.
//
//   POLAR_ACCESS_TOKEN        organization access token (Settings → Developers)
//   POLAR_WEBHOOK_SECRET      from the webhook (Settings → Webhooks)
//   POLAR_SERVER              "sandbox" while testing, "production" when live
//   POLAR_PRODUCT_<PLAN>_<PERIOD>
//                             the six products, e.g. POLAR_PRODUCT_CLUB_MONTH

export const PLAN_IDS: PlanId[] = ["starter", "club", "academy"];
export const PERIODS: Period[] = ["month", "year"];

const productEnv = (plan: PlanId, period: Period) =>
  process.env[`POLAR_PRODUCT_${plan.toUpperCase()}_${period.toUpperCase()}`] ?? "";

export function polarConfigured() {
  return !!process.env.POLAR_ACCESS_TOKEN && PLAN_IDS.some((p) => PERIODS.some((d) => productEnv(p, d)));
}

export const polarSandbox = () => process.env.POLAR_SERVER !== "production";

let client: ReturnType<typeof createPolar> | null = null;

export function getPolar() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) throw new Error("POLAR_ACCESS_TOKEN is not set");
  client ??= createPolar({ accessToken, environment: polarSandbox() ? "sandbox" : "production" });
  return client;
}

/** The Polar product for a plan and period, or null if it isn't set up. */
export function productFor(plan: PlanId, period: Period) {
  return productEnv(plan, period) || null;
}

/** Which plan and period a Polar product sells. */
export function planOfProduct(productId: string | null | undefined): { plan: PlanId; period: Period } | null {
  if (!productId) return null;
  for (const plan of PLAN_IDS) {
    for (const period of PERIODS) {
      if (productEnv(plan, period) === productId) return { plan, period };
    }
  }
  return null;
}

/** Which plans and periods can be bought by card right now. */
export function offeredProducts() {
  return PLAN_IDS.flatMap((plan) => PERIODS.filter((period) => productEnv(plan, period)).map((period) => ({ plan, period })));
}
