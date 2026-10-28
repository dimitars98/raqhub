// Knockout bracket maths. No database here, so it's easy to test.
//
// The bracket has a size that is a power of two (2, 4, 8, 16, 32, 64). With
// fewer entries than that, some first-round matches get a "bye": one player
// and an empty slot, and that player goes straight to round 2. Byes are
// spread over the bracket so two never meet.

export type TournamentStatus = "open" | "closed" | "started" | "finished";

export const TOURNAMENT_STATUSES: TournamentStatus[] = ["open", "closed", "started", "finished"];

export const MAX_ENTRIES_CHOICES = [4, 8, 16, 32, 64];

export type DrawMatch = {
  round: number;
  position: number;
  entry1_id: string | null;
  entry2_id: string | null;
  winner_id: string | null;
};

/** Smallest power of two that fits n entries (at least 2). */
export function bracketSize(n: number) {
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

export const roundCount = (entries: number) => Math.log2(bracketSize(entries));

/** Random order (Fisher–Yates). `random` can be replaced in tests. */
export function shuffle<T>(items: T[], random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Every match of the tournament, from round 1 to the final. Entries are used
 * in the order given (shuffle them first for a random draw). First-round
 * matches with a bye already have their winner, and that winner is already
 * placed in round 2.
 */
export function buildBracket(entryIds: string[]): DrawMatch[] {
  if (entryIds.length < 2) throw new Error("A draw needs at least 2 entries");
  const size = bracketSize(entryIds.length);
  const rounds = Math.log2(size);
  const firstRound = size / 2;
  const byes = size - entryIds.length;

  const matches: DrawMatch[] = [];
  const queue = [...entryIds];
  for (let p = 0; p < firstRound; p++) {
    // Spread the byes evenly: match p gets one when the running share of
    // byes crosses a whole number.
    const hasBye = Math.floor(((p + 1) * byes) / firstRound) > Math.floor((p * byes) / firstRound);
    const entry1 = queue.shift() ?? null;
    const entry2 = hasBye ? null : (queue.shift() ?? null);
    matches.push({
      round: 1,
      position: p,
      entry1_id: entry1,
      entry2_id: entry2,
      winner_id: entry2 === null ? entry1 : null,
    });
  }

  for (let r = 2; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let p = 0; p < count; p++) {
      matches.push({ round: r, position: p, entry1_id: null, entry2_id: null, winner_id: null });
    }
  }

  // Byes go through to round 2 straight away.
  for (const m of matches.filter((m) => m.round === 1 && m.winner_id)) {
    const next = nextSlot(m.round, m.position);
    const target = matches.find((x) => x.round === next.round && x.position === next.position);
    if (target) target[next.slot] = m.winner_id;
  }
  return matches;
}

/** Where the winner of a match plays next. */
export function nextSlot(round: number, position: number) {
  return {
    round: round + 1,
    position: Math.floor(position / 2),
    slot: (position % 2 === 0 ? "entry1_id" : "entry2_id") as "entry1_id" | "entry2_id",
  };
}

/**
 * Name of a round, as a translation key and its count: the last round is
 * "final", the one before "semi", then "quarter", then "roundOf" 16, 32, 64.
 */
export function roundName(round: number, rounds: number): { key: string; n?: number } {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return { key: "final" };
  if (fromEnd === 1) return { key: "semi" };
  if (fromEnd === 2) return { key: "quarter" };
  return { key: "roundOf", n: 2 ** (fromEnd + 1) };
}

/** "Ana / Marko" for a pair, the name alone otherwise. */
export const entryName = (e: { name: string; partner_name?: string | null }) =>
  e.partner_name ? `${e.name} / ${e.partner_name}` : e.name;
