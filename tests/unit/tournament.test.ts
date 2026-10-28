// Knockout draws (src/lib/tournament.ts).
import { describe, expect, it } from "vitest";
import { bracketSize, buildBracket, entryName, nextSlot, roundName, shuffle } from "@/lib/tournament";

const entries = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`);

describe("buildBracket", () => {
  it("has one match fewer than there are places", () => {
    expect(buildBracket(entries(8))).toHaveLength(7);
    expect(buildBracket(entries(5))).toHaveLength(7);
    expect(buildBracket(entries(2))).toHaveLength(1);
  });

  it("uses every entry exactly once in round 1", () => {
    const ids = entries(11);
    const first = buildBracket(ids).filter((m) => m.round === 1);
    const used = first.flatMap((m) => [m.entry1_id, m.entry2_id]).filter(Boolean);
    expect(used.sort()).toEqual([...ids].sort());
  });

  it("sends players with a bye straight to round 2", () => {
    const draw = buildBracket(entries(6)); // 8 places, 2 byes
    const byes = draw.filter((m) => m.round === 1 && m.entry2_id === null);
    expect(byes).toHaveLength(2);
    for (const m of byes) {
      expect(m.winner_id).toBe(m.entry1_id);
      const next = nextSlot(1, m.position);
      const target = draw.find((x) => x.round === next.round && x.position === next.position)!;
      expect(target[next.slot]).toBe(m.entry1_id);
    }
  });

  it("never pairs two byes in one match", () => {
    for (let n = 2; n <= 64; n++) {
      const empty = buildBracket(entries(n)).filter((m) => m.round === 1 && !m.entry1_id && !m.entry2_id);
      expect(empty).toHaveLength(0);
    }
  });

  it("needs at least two entries", () => {
    expect(() => buildBracket(["only"])).toThrow();
  });
});

describe("bracket helpers", () => {
  it("rounds the draw up to a power of two", () => {
    expect([1, 2, 3, 5, 8, 9, 33].map(bracketSize)).toEqual([2, 2, 4, 8, 8, 16, 64]);
  });

  it("names rounds from the final backwards", () => {
    expect(roundName(4, 4)).toEqual({ key: "final" });
    expect(roundName(3, 4)).toEqual({ key: "semi" });
    expect(roundName(2, 4)).toEqual({ key: "quarter" });
    expect(roundName(1, 4)).toEqual({ key: "roundOf", n: 16 });
  });

  it("shuffles without losing anyone", () => {
    const ids = entries(16);
    expect(shuffle(ids).sort()).toEqual([...ids].sort());
  });

  it("shows pairs as 'Ana / Marko'", () => {
    expect(entryName({ name: "Ana", partner_name: "Marko" })).toBe("Ana / Marko");
    expect(entryName({ name: "Ana", partner_name: null })).toBe("Ana");
  });
});
