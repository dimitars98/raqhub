// Americano and Mexicano evenings (supabase/migrations/20261030_americano.sql).
//
// Everyone plays for themselves: each round, players are put in fours on
// the courts, two against two, in one game to a set number of points. Each
// player keeps the points their side won. Partners change every round.
//
// This file has no database or React code, so it can be tested on its own.

import type { Sport } from "@/types/database";

export type SocialFormat = "americano" | "mexicano";
export type SocialStatus = "open" | "running" | "finished";

export interface SocialEvent {
  id: string;
  /** The club's poster for it (20261103_event_posters.sql). */
  cover_url?: string | null;
  club_id: string;
  name: string;
  sport: Sport;
  format: SocialFormat;
  starts_at: string;
  ends_at: string;
  court_ids: string[];
  points_per_match: number;
  max_players: number;
  entry_fee: number | null;
  level_min: number | null;
  level_max: number | null;
  description: string | null;
  status: SocialStatus;
  created_at: string;
}

export interface SocialPlayer {
  id: string;
  name: string;
  level: number | null;
  status: "active" | "withdrawn";
  created_at: string;
  mine: boolean;
}

export interface SocialMatch {
  id: string;
  round: number;
  court_index: number;
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  score_a: number | null;
  score_b: number | null;
  reported_by_me: boolean;
}

/** What social_view() returns. */
export interface SocialView {
  event: SocialEvent;
  club: { name: string; slug: string; city: string | null };
  manages: boolean;
  courts: { id: string; name: string }[];
  players: SocialPlayer[];
  matches: SocialMatch[];
  byes: { round: number; player: string }[];
}

export const POINTS_CHOICES = [16, 21, 24, 32];

/** Points a player gets for sitting a round out: half a game, rounded up. */
export const byePoints = (pointsPerMatch: number) => Math.ceil(pointsPerMatch / 2);

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export interface Standing {
  player: string;
  points: number;
  played: number;
  won: number;
  /** Rounds sat out. */
  byes: number;
  rank: number;
}

/**
 * Everyone's points so far. Ties: games won, then the fewest rounds sat
 * out, then the order they signed up.
 */
export function standings(view: Pick<SocialView, "players" | "matches" | "byes" | "event">): Standing[] {
  const rows = new Map<string, Standing>(
    view.players.map((p) => [p.id, { player: p.id, points: 0, played: 0, won: 0, byes: 0, rank: 0 }]),
  );
  for (const m of view.matches) {
    if (m.score_a == null || m.score_b == null) continue;
    for (const [side, mine, theirs] of [
      [[m.a1, m.a2], m.score_a, m.score_b],
      [[m.b1, m.b2], m.score_b, m.score_a],
    ] as const) {
      for (const id of side) {
        const r = rows.get(id);
        if (!r) continue;
        r.points += mine;
        r.played += 1;
        if (mine > theirs) r.won += 1;
      }
    }
  }
  const bye = byePoints(view.event.points_per_match);
  for (const b of view.byes) {
    const r = rows.get(b.player);
    if (!r) continue;
    r.byes += 1;
    // A round sat out counts once its games have scores.
    const roundDone = view.matches.filter((m) => m.round === b.round).every((m) => m.score_a != null);
    if (roundDone) r.points += bye;
  }
  const order = new Map(view.players.map((p, i) => [p.id, i]));
  const sorted = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points || b.won - a.won || a.byes - b.byes || (order.get(a.player)! - order.get(b.player)!),
  );
  sorted.forEach((r, i) => (r.rank = i + 1));
  return sorted;
}

// ---------------------------------------------------------------------------
// Making a round
// ---------------------------------------------------------------------------

export interface NewRound {
  /** One per court used, in court order: [a1, a2, b1, b2]. */
  games: [string, string, string, string][];
  byes: string[];
}

type History = {
  partners: Map<string, number>;
  opponents: Map<string, number>;
  byes: Map<string, number>;
};

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function history(matches: SocialMatch[], byes: { player: string }[]): History {
  const h: History = { partners: new Map(), opponents: new Map(), byes: new Map() };
  const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const m of matches) {
    add(h.partners, pairKey(m.a1, m.a2));
    add(h.partners, pairKey(m.b1, m.b2));
    for (const a of [m.a1, m.a2]) for (const b of [m.b1, m.b2]) add(h.opponents, pairKey(a, b));
  }
  for (const b of byes) add(h.byes, b.player);
  return h;
}

/** How many courts the next round uses, and how many sit out. */
export function roundShape(players: number, courts: number) {
  const games = Math.min(courts, Math.floor(players / 4));
  return { games, byes: players - games * 4 };
}

/** A small seeded random generator, so a round can be made again identically in tests. */
function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rnd: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Who sits out: those who sat out least, then (Mexicano) the lowest in the table. */
function pickByes(ids: string[], count: number, h: History, rnd: () => number, rankOf?: Map<string, number>) {
  if (count <= 0) return [];
  const order = shuffle(ids, rnd).sort(
    (a, b) => (h.byes.get(a) ?? 0) - (h.byes.get(b) ?? 0) || (rankOf ? rankOf.get(b)! - rankOf.get(a)! : 0),
  );
  return order.slice(0, count);
}

const SPLITS = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
] as const;

/** Cost of a game: playing again with the same partner is much worse than the same opponent. */
function gameCost(g: readonly string[], h: History) {
  const [a1, a2, b1, b2] = g;
  let cost = 10 * ((h.partners.get(pairKey(a1, a2)) ?? 0) + (h.partners.get(pairKey(b1, b2)) ?? 0));
  for (const a of [a1, a2]) for (const b of [b1, b2]) cost += h.opponents.get(pairKey(a, b)) ?? 0;
  return cost;
}

/** The best of the three ways to split four players into two pairs. */
function bestSplit(four: string[], h: History) {
  let best: [string, string, string, string] = [four[0], four[1], four[2], four[3]];
  let bestCost = Infinity;
  for (const s of SPLITS) {
    const g: [string, string, string, string] = [four[s[0]], four[s[1]], four[s[2]], four[s[3]]];
    const c = gameCost(g, h);
    if (c < bestCost) {
      bestCost = c;
      best = g;
    }
  }
  return { game: best, cost: bestCost };
}

/**
 * The next round of an Americano: as few repeated partners (and opponents)
 * as possible. Tries many random groupings and keeps the best.
 */
export function americanoRound(
  playerIds: string[],
  courts: number,
  matches: SocialMatch[],
  byes: { player: string }[],
  seed = Date.now(),
): NewRound {
  const rnd = random(seed);
  const h = history(matches, byes);
  const shape = roundShape(playerIds.length, courts);
  const out = pickByes(playerIds, shape.byes, h, rnd);
  const playing = playerIds.filter((id) => !out.includes(id));

  let best: NewRound = { games: [], byes: out };
  let bestCost = Infinity;
  for (let attempt = 0; attempt < 400; attempt++) {
    const order = shuffle(playing, rnd);
    const games: [string, string, string, string][] = [];
    let cost = 0;
    for (let g = 0; g < shape.games; g++) {
      const split = bestSplit(order.slice(g * 4, g * 4 + 4), h);
      games.push(split.game);
      cost += split.cost;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = { games, byes: out };
      if (cost === 0) break;
    }
  }
  return best;
}

/**
 * The next round of a Mexicano: players grouped by the table, top four on
 * the first court; in each four, 1st and 3rd play 2nd and 4th. Round 1 is
 * an Americano round (nobody has points yet).
 */
export function mexicanoRound(
  view: Pick<SocialView, "players" | "matches" | "byes" | "event">,
  playerIds: string[],
  courts: number,
  seed = Date.now(),
): NewRound {
  if (view.matches.length === 0) return americanoRound(playerIds, courts, [], [], seed);
  const rnd = random(seed);
  const h = history(view.matches, view.byes);
  const table = standings(view).filter((s) => playerIds.includes(s.player));
  const rankOf = new Map(table.map((s, i) => [s.player, i]));
  const shape = roundShape(playerIds.length, courts);
  const out = pickByes(playerIds, shape.byes, h, rnd, rankOf);
  const playing = table.map((s) => s.player).filter((id) => !out.includes(id));
  const games: [string, string, string, string][] = [];
  for (let g = 0; g < shape.games; g++) {
    const [p1, p2, p3, p4] = playing.slice(g * 4, g * 4 + 4);
    games.push([p1, p3, p2, p4]);
  }
  return { games, byes: out };
}

/** Rounds for everyone to partner everyone once (Americano): players − 1, at least 3. */
export function suggestedRounds(players: number) {
  return Math.max(3, players - 1);
}
