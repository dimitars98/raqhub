// Turns a database error from the league functions into a message key under
// leagues.errors (see 20261028_leagues.sql for where each comes from).

export type LeagueResult = { error?: string };

const KNOWN = [
  "league_closed",
  "league_full",
  "league_already_reported",
  "league_already",
  "league_level",
  "league_partner",
  "league_name",
  "league_too_few",
  "league_has_scores",
  "league_score",
  "league_round_done",
  "league_finished",
  "league_started",
  "not_signed_in",
  "club_locked",
] as const;

const KEY: Record<(typeof KNOWN)[number], string> = {
  league_closed: "closed",
  league_full: "full",
  league_already_reported: "alreadyReported",
  league_already: "already",
  league_level: "level",
  league_partner: "partner",
  league_name: "entryName",
  league_too_few: "tooFew",
  league_has_scores: "hasScores",
  league_score: "score",
  league_round_done: "roundDone",
  league_finished: "finished",
  league_started: "started",
  not_signed_in: "notSignedIn",
  club_locked: "paused",
};

export function leagueError(error: { message?: string; code?: string } | null, where: string) {
  const message = error?.message ?? "";
  const hit = KNOWN.find((k) => message.includes(k));
  if (hit) return KEY[hit];
  if (error?.code === "23505") return "already";
  console.error(where, error);
  return "failed";
}
