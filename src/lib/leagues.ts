// Box leagues (supabase/migrations/20261028_leagues.sql).
//
// Players or pairs play everyone in their box during a round; after it the
// best of each box move up and the last move down.

import type { Sport } from "@/types/database";

export type LeagueStatus = "open" | "running" | "finished";

export interface League {
  id: string;
  club_id: string;
  name: string;
  sport: Sport;
  /** 1: singles · 2: pairs */
  team_size: 1 | 2;
  box_size: number;
  round_weeks: number;
  move_count: number;
  starts_on: string;
  max_entries: number;
  entry_fee: number | null;
  level_min: number | null;
  level_max: number | null;
  description: string | null;
  status: LeagueStatus;
  created_at: string;
}

export interface LeagueEntry {
  id: string;
  name: string;
  partner_name: string | null;
  level: number | null;
  seed: number;
  status: "active" | "withdrawn";
  created_at: string;
  /** The signed-in player's own entry. */
  mine: boolean;
}

export interface LeagueStanding {
  entry_id: string;
  played: number;
  won: number;
  lost: number;
  sets_won: number;
  sets_lost: number;
  games_won: number;
  games_lost: number;
  points: number;
  rank: number;
}

/** A set from entry 1's side: [6, 4]. */
export type SetScore = [number, number];

export interface LeagueMatch {
  id: string;
  entry1_id: string;
  entry2_id: string;
  sets: SetScore[] | null;
  winner_id: string | null;
  walkover: boolean;
  reported_at: string | null;
  reported_by_me: boolean;
}

export interface LeagueBox {
  id: string;
  number: number;
  standings: LeagueStanding[];
  matches: LeagueMatch[];
}

export interface LeagueRound {
  id: string;
  number: number;
  starts_on: string;
  ends_on: string;
  status: "playing" | "done";
  boxes: LeagueBox[];
}

/** What league_view() returns. Rounds come newest first. */
export interface LeagueView {
  league: League;
  club: { name: string; slug: string; city: string | null };
  /** The signed-in user runs this club. */
  manages: boolean;
  entries: LeagueEntry[];
  rounds: LeagueRound[];
}

export const BOX_SIZES = [3, 4, 5, 6];
export const ROUND_WEEKS = [1, 2, 3, 4, 5, 6, 8];
export const LEVELS = Array.from({ length: 13 }, (_, i) => 1 + i * 0.5);

/** "Ana / Marko" for a pair. */
export const entryName = (e: Pick<LeagueEntry, "name" | "partner_name">) =>
  e.partner_name ? `${e.name} / ${e.partner_name}` : e.name;

/** "6-4 3-6 10-8", from either side. */
export function scoreText(sets: SetScore[] | null, flip = false) {
  if (!sets?.length) return "";
  return sets.map(([a, b]) => (flip ? `${b}-${a}` : `${a}-${b}`)).join(" ");
}
