import type { Surface } from "@/types/database";

// The colour a court really is (courts.color, 20261027b_court_colors.sql).
// A club picks it per court; without one, the surface's usual colour is used.

export const COURT_COLORS = ["blue", "green", "terracotta", "red", "purple", "grey"] as const;
export type CourtColor = (typeof COURT_COLORS)[number];

/** The court's fill and its line colour, for drawings and swatches. */
export const COURT_COLOR_HEX: Record<CourtColor, { court: string; lines: string }> = {
  blue: { court: "#378add", lines: "#e8f4fd" },
  green: { court: "#5f9b2e", lines: "#eef8e3" },
  terracotta: { court: "#d9773f", lines: "#fbe6d8" },
  red: { court: "#b8433a", lines: "#fbe3e1" },
  purple: { court: "#6d5bb8", lines: "#eeebfa" },
  grey: { court: "#8a9389", lines: "#f1f3ef" },
};

/** The usual colour of each surface. */
export const SURFACE_DEFAULT_COLOR: Record<Surface, CourtColor> = {
  clay: "terracotta",
  hard: "blue",
  acrylic: "blue",
  concrete: "grey",
  grass: "green",
  artificial_grass: "green",
  carpet: "green",
};

export const isCourtColor = (v: unknown): v is CourtColor =>
  typeof v === "string" && (COURT_COLORS as readonly string[]).includes(v);

/** The colour to draw: the club's choice, or the surface's usual one. */
export const courtColor = (court: { color?: string | null; surface: Surface }): CourtColor =>
  isCourtColor(court.color) ? court.color : (SURFACE_DEFAULT_COLOR[court.surface] ?? "blue");
