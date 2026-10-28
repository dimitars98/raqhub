import type { LeagueStatus } from "@/lib/leagues";

/** Badge colours for a league's status, like the tournament ones. */
export const LEAGUE_STATUS_TONE: Record<LeagueStatus, string> = {
  open: "bg-brand-100 text-brand-800",
  running: "bg-court-100 text-court-800",
  finished: "bg-ink-100 text-ink-600",
};
