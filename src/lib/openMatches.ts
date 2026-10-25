import type { Sport } from "@/types/database";

// Open matches and player levels (supabase/migrations/20261026_open_matches.sql).
// The database checks everything; this file holds the shapes the screens get
// back and the club's settings.

export const MATCH_SPORTS: Sport[] = ["padel", "tennis", "pickleball"];

/** Levels go from 1.0 to 7.0 in steps of 0.5. */
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 7;
export const LEVELS = Array.from({ length: (LEVEL_MAX - LEVEL_MIN) * 2 + 1 }, (_, i) => LEVEL_MIN + i / 2);

/** The bands players pick from when they set their level, lowest first. */
export const LEVEL_BANDS = [
  { key: "starting", from: 1, to: 1.5 },
  { key: "beginner", from: 2, to: 2.5 },
  { key: "intermediate", from: 3, to: 3.5 },
  { key: "advanced", from: 4, to: 4.5 },
  { key: "competition", from: 5, to: 7 },
] as const;
export type LevelBand = (typeof LEVEL_BANDS)[number]["key"];

export const bandOf = (level: number): LevelBand =>
  (LEVEL_BANDS.find((b) => level >= b.from && level <= b.to) ?? LEVEL_BANDS[0]).key;

/** "3.5" */
export const levelText = (level: number | string | null | undefined) =>
  level == null || level === "" ? "–" : Number(level).toFixed(1);

/** "3.0–4.0" */
export const rangeText = (min: number | string, max: number | string) =>
  Number(min) === Number(max) ? levelText(min) : `${levelText(min)}–${levelText(max)}`;

export const clampLevel = (n: number) => Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(n * 2) / 2));

/** Padel is always doubles; tennis and pickleball can be singles. */
export const canPlaySingles = (sport: Sport) => sport !== "padel";

// ---------------------------------------------------------------------------
// The club's settings (clubs.open_matches). Keep the defaults in step with
// match_settings() in the migration.
// ---------------------------------------------------------------------------

export const RELEASE_HOUR_CHOICES = [6, 12, 24] as const;

export type MatchSettings = {
  enabled: boolean;
  sports: Sport[];
  /** If a match isn't full this many hours before the start, the court goes back. */
  release_hours: number;
  /** Only the club's members can start or join matches. */
  members_only: boolean;
};

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  enabled: true,
  sports: [...MATCH_SPORTS],
  release_hours: 6,
  members_only: false,
};

export function normalizeMatchSettings(raw: unknown): MatchSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof MatchSettings, unknown>>;
  const sports = Array.isArray(r.sports)
    ? MATCH_SPORTS.filter((s) => (r.sports as unknown[]).includes(s))
    : DEFAULT_MATCH_SETTINGS.sports;
  const hours = Number(r.release_hours);
  return {
    enabled: r.enabled !== false,
    sports,
    release_hours: (RELEASE_HOUR_CHOICES as readonly number[]).includes(hours)
      ? hours
      : DEFAULT_MATCH_SETTINGS.release_hours,
    members_only: r.members_only === true,
  };
}

// ---------------------------------------------------------------------------
// What the database functions return
// ---------------------------------------------------------------------------

export type MatchPlayer = {
  /** Only for the organiser and the club. */
  id?: string;
  name: string;
  level: number | null;
  /** A club confirmed this player's level. */
  checked: boolean;
  team: 1 | 2;
  organiser: boolean;
  me: boolean;
};

export type MatchStatus = "open" | "cancelled" | "released";

export type MatchCard = {
  id: string;
  sport: Sport;
  starts_at: string;
  ends_at: string;
  level_min: number;
  level_max: number;
  competitive: boolean;
  max_players: 2 | 4;
  price_each: number;
  status: MatchStatus;
  taken: number;
  court: string | null;
  indoor: boolean | null;
  club: { id: string; name: string; slug: string; city: string | null };
  members_only: boolean;
  players: MatchPlayer[];
  /** The signed-in player's place: in, requested, or null. */
  mine: "in" | "requested" | null;
  organiser: boolean;
};

export type MatchMessage = { name: string; body: string; at: string; me: boolean };

export type MatchDetail = MatchCard & {
  /** Only for the organiser: cancelling it cancels the match. */
  booking_id: string | null;
  note: string | null;
  keep_court: boolean;
  release_at: string;
  leave_until: string;
  club_phone: string | null;
  club_address: string | null;
  /** Players outside the level range who asked; only the organiser sees them. */
  requests: MatchPlayer[];
  /** Only for the players in the match. */
  messages: MatchMessage[] | null;
};

export type MatchClub = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  sports: Sport[];
  members_only: boolean;
  member: boolean;
};

export type MyLevel = {
  sport: Sport;
  level: number;
  confirmed_at: string | null;
  confirmed_club: string | null;
  check_club: string | null;
  check_club_name: string | null;
};

export type ClubMatchesView = {
  settings: unknown;
  upcoming: {
    id: string;
    sport: Sport;
    starts_at: string;
    ends_at: string;
    court: string | null;
    level_min: number;
    level_max: number;
    competitive: boolean;
    max_players: number;
    taken: number;
    status: MatchStatus;
    keep_court: boolean;
    organiser: string;
  }[];
  stats: { opened: number; filled: number; released: number; players: number };
  checks: { id: string; name: string; sport: Sport; level: number; requested_at: string }[];
};

export const placesLeft = (m: Pick<MatchCard, "max_players" | "taken">) => Math.max(0, m.max_players - m.taken);
export const isFull = (m: Pick<MatchCard, "max_players" | "taken">) => m.taken >= m.max_players;
export const fitsLevel = (m: Pick<MatchCard, "level_min" | "level_max">, level: number | null | undefined) =>
  level != null && level >= Number(m.level_min) && level <= Number(m.level_max);

/** Maps a database error to a key in the "matches.errors" messages. */
export function matchErrorKey(message: string | undefined) {
  const m = message ?? "";
  if (m.includes("club_locked")) return "paused";
  if (m.includes("sign in")) return "notSignedIn";
  if (m.includes("Set your level")) return "needLevel";
  if (m.includes("members only")) return "membersOnly";
  if (m.includes("full")) return "full";
  if (m.includes("Already")) return "already";
  if (m.includes("no longer open") || m.includes("can't be opened")) return "closed";
  if (m.includes("Too late")) return "tooLate";
  if (m.includes("doesn't take open matches")) return "sportOff";
  if (m.includes("Levels go")) return "levels";
  if (m.includes("Too many messages")) return "tooManyMessages";
  if (m.includes("Not allowed") || m.includes("organiser cancels")) return "notAllowed";
  return "failed";
}
