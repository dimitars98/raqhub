import type { Sport, Surface } from "@/types/database";

// The colour a court really is (courts.color, 20261027b_court_colors.sql).
// A club picks it per court; without one, the usual colour for its sport and
// surface is used (padel: blue).

export const COURT_COLORS = ["blue", "blue_green", "green", "terracotta", "red", "purple", "grey"] as const;
export type CourtColor = (typeof COURT_COLORS)[number];

/**
 * The court's fill and its line colour, for drawings and swatches. `inner`:
 * a two-colour court, e.g. the usual hard court with a blue playing area
 * inside a green surround.
 */
export const COURT_COLOR_HEX: Record<CourtColor, { court: string; lines: string; inner?: string }> = {
  blue: { court: "#378add", lines: "#e8f4fd" },
  blue_green: { court: "#4e8a5c", inner: "#2f72bd", lines: "#eef6f1" },
  green: { court: "#5f9b2e", lines: "#eef8e3" },
  terracotta: { court: "#d9773f", lines: "#fbe6d8" },
  red: { court: "#b8433a", lines: "#fbe3e1" },
  purple: { court: "#6d5bb8", lines: "#eeebfa" },
  grey: { court: "#8a9389", lines: "#f1f3ef" },
};

/** Only these surfaces offer plain green (grass and carpet); hard courts get blue-green. */
export const GREEN_SURFACES: Surface[] = ["grass", "artificial_grass", "carpet"];

/** The colours to offer for a surface. */
export const colorsFor = (surface: Surface): CourtColor[] =>
  COURT_COLORS.filter((c) => c !== "green" || GREEN_SURFACES.includes(surface));

/** A swatch's background: two halves for a two-colour court. */
export const swatchStyle = (c: CourtColor) => {
  const hex = COURT_COLOR_HEX[c];
  return hex.inner
    ? { background: `linear-gradient(135deg, ${hex.court} 50%, ${hex.inner} 50%)` }
    : { backgroundColor: hex.court };
};

/** The usual colour of each surface. */
export const SURFACE_DEFAULT_COLOR: Record<Surface, CourtColor> = {
  clay: "terracotta",
  hard: "blue_green",
  acrylic: "blue",
  concrete: "grey",
  grass: "green",
  artificial_grass: "green",
  carpet: "green",
};

export const isCourtColor = (v: unknown): v is CourtColor =>
  typeof v === "string" && (COURT_COLORS as readonly string[]).includes(v);

/**
 * The usual colour of a court: most padel courts are blue, whatever the
 * surface; otherwise the surface decides.
 */
export const defaultColor = (sport: Sport | string | null | undefined, surface: Surface): CourtColor =>
  sport === "padel" ? "blue" : (SURFACE_DEFAULT_COLOR[surface] ?? "blue");

/** The colour to draw: the club's choice, or the usual one for its sport and surface. */
export const courtColor = (court: { color?: string | null; surface: Surface; sport?: Sport | string | null }): CourtColor =>
  isCourtColor(court.color) ? court.color : defaultColor(court.sport, court.surface);
