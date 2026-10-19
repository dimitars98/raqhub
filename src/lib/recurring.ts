// Weekly repeating bookings: "every Tuesday at 19:00 for 12 weeks".
//
// Each week is an ordinary booking; the weeks made together share a
// series_id (supabase/migrations/20261019_recurring_bookings.sql).

import { addWeeks } from "date-fns";

/** How many weeks a club can choose. 1 = just once. */
export const REPEAT_CHOICES = [1, 4, 8, 12, 26];

/**
 * Start of every week's booking, the first one included. Uses local time,
 * so 19:00 stays 19:00 when the clocks change for summer or winter time.
 */
export function weeklyStarts(first: Date, weeks: number) {
  return Array.from({ length: Math.max(1, weeks) }, (_, i) => addWeeks(first, i));
}
