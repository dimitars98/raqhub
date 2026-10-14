// Date maths for recording a club's payment on the owner page. Dates are
// yyyy-mm-dd strings in club time, like clubs.paid_until.

import { addDays } from "@/lib/automation/time";

export type Period = "month" | "year";
export const PERIOD_MONTHS: Record<Period, number> = { month: 1, year: 12 };

/** Adds whole months, keeping the day where it exists (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * The new paid_until after a payment. A payment covers the time after what
 * the club already has: after the free trial, after an earlier payment, or
 * from today if both are over.
 *   today 10 Nov, trial to 13 Nov, one month  -> paid until 12 Dec
 *   paid until 31 Dec, one year               -> paid until 31 Dec next year
 */
export function nextPaidUntil(opts: {
  today: string;
  trialEndsOn: string | null;
  paidUntil: string | null;
  period: Period;
}) {
  const starts = [opts.today];
  if (opts.trialEndsOn) starts.push(opts.trialEndsOn);
  if (opts.paidUntil) starts.push(addDays(opts.paidUntil, 1));
  const start = starts.sort().at(-1)!;
  return addDays(addMonths(start, PERIOD_MONTHS[opts.period]), -1);
}
