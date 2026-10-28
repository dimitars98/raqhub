// Americano and Mexicano: making rounds and keeping the table (src/lib/americano.ts).
import { describe, expect, it } from "vitest";
import {
  americanoRound,
  byePoints,
  mexicanoRound,
  roundShape,
  standings,
  suggestedRounds,
  type SocialMatch,
  type SocialView,
} from "@/lib/americano";

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** A view with these players and matches, as social_view() would return it. */
function view(ids: string[], matches: SocialMatch[] = [], byes: { round: number; player: string }[] = []) {
  return {
    event: { points_per_match: 24 } as SocialView["event"],
    players: ids.map((id, i) => ({
      id,
      name: id,
      level: null,
      status: "active" as const,
      created_at: `2026-10-01T10:00:0${i}Z`,
      mine: false,
    })),
    matches,
    byes,
  };
}

/** Plays a whole Americano evening and returns every round's matches. */
function playEvening(ids: string[], courts: number, rounds: number) {
  const matches: SocialMatch[] = [];
  const byes: { round: number; player: string }[] = [];
  for (let r = 1; r <= rounds; r++) {
    const next = americanoRound(ids, courts, matches, byes, r * 7919);
    next.games.forEach(([a1, a2, b1, b2], i) =>
      matches.push({ id: `m${r}-${i}`, round: r, court_index: i, a1, a2, b1, b2, score_a: 12, score_b: 12, reported_by_me: false }),
    );
    next.byes.forEach((player) => byes.push({ round: r, player }));
  }
  return { matches, byes };
}

describe("roundShape", () => {
  it("fills as many courts as there are fours", () => {
    expect(roundShape(8, 2)).toEqual({ games: 2, byes: 0 });
    expect(roundShape(10, 2)).toEqual({ games: 2, byes: 2 });
    expect(roundShape(12, 2)).toEqual({ games: 2, byes: 4 });
    expect(roundShape(7, 3)).toEqual({ games: 1, byes: 3 });
  });
});

describe("americanoRound", () => {
  it("puts every player in exactly one place", () => {
    const ids = players(10);
    const round = americanoRound(ids, 2, [], [], 1);
    const placed = [...round.games.flat(), ...round.byes];
    expect(placed.sort()).toEqual([...ids].sort());
    expect(round.games).toHaveLength(2);
    expect(round.byes).toHaveLength(2);
  });

  it("gives 8 players on 2 courts a new partner every round for 7 rounds", () => {
    const { matches } = playEvening(players(8), 2, 7);
    const pairs = matches.flatMap((m) => [[m.a1, m.a2].sort().join("+"), [m.b1, m.b2].sort().join("+")]);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("shares sitting out fairly", () => {
    const { byes } = playEvening(players(10), 2, 5);
    const counts = new Map<string, number>();
    for (const b of byes) counts.set(b.player, (counts.get(b.player) ?? 0) + 1);
    // 10 sit-outs over 10 players: everyone sits out once.
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
    expect(counts.size).toBe(10);
  });

  it("makes the same round again from the same seed", () => {
    const ids = players(8);
    expect(americanoRound(ids, 2, [], [], 42)).toEqual(americanoRound(ids, 2, [], [], 42));
  });
});

describe("mexicanoRound", () => {
  it("puts the top four on the first court: 1st and 3rd against 2nd and 4th", () => {
    const ids = players(8);
    // Round 1: p1+p2 beat p3+p4 20–4; p5+p6 beat p7+p8 14–10.
    const matches: SocialMatch[] = [
      { id: "a", round: 1, court_index: 0, a1: "p1", a2: "p2", b1: "p3", b2: "p4", score_a: 20, score_b: 4, reported_by_me: false },
      { id: "b", round: 1, court_index: 1, a1: "p5", a2: "p6", b1: "p7", b2: "p8", score_a: 14, score_b: 10, reported_by_me: false },
    ];
    const round = mexicanoRound(view(ids, matches), ids, 2, 1);
    // Table: p1 20, p2 20, p5 14, p6 14, p7 10, p8 10, p3 4, p4 4
    expect(round.games[0]).toEqual(["p1", "p5", "p2", "p6"]);
    expect(round.games[1]).toEqual(["p7", "p3", "p8", "p4"]);
  });
});

describe("standings", () => {
  it("adds up points and games won", () => {
    const ids = players(4);
    const table = standings(
      view(ids, [{ id: "a", round: 1, court_index: 0, a1: "p1", a2: "p2", b1: "p3", b2: "p4", score_a: 15, score_b: 9, reported_by_me: false }]),
    );
    expect(table.map((s) => [s.player, s.points, s.won])).toEqual([
      ["p1", 15, 1],
      ["p2", 15, 1],
      ["p3", 9, 0],
      ["p4", 9, 0],
    ]);
    expect(table.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
  });

  it("gives half a game for sitting out, once the round is scored", () => {
    const ids = players(5);
    const match: SocialMatch = { id: "a", round: 1, court_index: 0, a1: "p1", a2: "p2", b1: "p3", b2: "p4", score_a: null, score_b: null, reported_by_me: false };
    const unscored = standings(view(ids, [match], [{ round: 1, player: "p5" }]));
    expect(unscored.find((s) => s.player === "p5")!.points).toBe(0);
    const scored = standings(view(ids, [{ ...match, score_a: 12, score_b: 12 }], [{ round: 1, player: "p5" }]));
    expect(scored.find((s) => s.player === "p5")!.points).toBe(byePoints(24));
    expect(byePoints(21)).toBe(11);
  });
});

describe("suggestedRounds", () => {
  it("is enough for everyone to partner everyone once", () => {
    expect(suggestedRounds(8)).toBe(7);
    expect(suggestedRounds(4)).toBe(3);
  });
});
