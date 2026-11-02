import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Sport, Surface } from "@/types/database";

// The public club directory: every active club on RaqHub, grouped by city,
// for the /courts pages and the sitemap. Read as a visitor (no cookies), so
// it shows exactly what anyone may see, and the same for everyone.

export type DirectoryClub = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string;
  citySlug: string;
  logo_url: string | null;
  cover_url: string | null;
  sports: Sport[];
  courts: number;
  indoor: boolean;
  /** Cheapest court per hour, euros. */
  priceFrom: number | null;
  /** A court to draw when the club has no cover photo. */
  art: { sport: Sport; surface: Surface; color: string | null };
};

export type DirectoryCity = {
  slug: string;
  name: string;
  clubs: number;
  sports: Sport[];
};

const SPORT_ORDER: Sport[] = ["padel", "tennis", "pickleball"];

// Macedonian and Serbian Cyrillic, so "Скопје" and "Skopje" are one city.
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ѓ: "gj", ђ: "dj", е: "e", ж: "zh",
  з: "z", ѕ: "dz", и: "i", ј: "j", к: "k", л: "l", љ: "lj", м: "m", н: "n",
  њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ќ: "kj", ћ: "c", у: "u",
  ф: "f", х: "h", ц: "c", ч: "ch", џ: "dz", ш: "sh",
};

/** "Скопје" → "skopje", "Niš" → "nis", "Novi Sad" → "novi-sad". */
export function citySlug(city: string): string {
  return [...city.trim().toLowerCase()]
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join("")
    // Latin letters with a hook, spelled like their Cyrillic twins: Štip = Штип.
    .replace(/đ/g, "dj")
    .replace(/š/g, "sh")
    .replace(/ž/g, "zh")
    .replace(/č/g, "ch")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function visitorClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Active, bookable clubs with a city and at least one active court.
 * Never throws: if the database can't be reached (e.g. while building without
 * its address), the directory is just empty.
 */
export async function loadDirectory(): Promise<DirectoryClub[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return [];
  try {
    return await readDirectory();
  } catch (error) {
    console.error("loadDirectory failed:", error);
    return [];
  }
}

async function readDirectory(): Promise<DirectoryClub[]> {
  const db = visitorClient();
  const { data: clubs } = await db
    .from("clubs")
    .select("id, name, slug, description, address, city, logo_url, cover_url")
    .eq("is_active", true)
    .not("city", "is", null);
  if (!clubs?.length) return [];

  const ids = clubs.map((c) => c.id);
  const [{ data: courts }, { data: paused }] = await Promise.all([
    db
      .from("courts")
      .select("club_id, sport, surface, is_indoor, price_per_hour, color")
      .eq("is_active", true)
      .in("club_id", ids),
    // Clubs whose trial ran out can't take bookings, so they aren't listed.
    db.rpc("paused_clubs", { p_clubs: ids }),
  ]);
  const pausedIds = new Set(paused ?? []);

  const byClub = new Map<string, NonNullable<typeof courts>>();
  for (const c of courts ?? []) {
    const list = byClub.get(c.club_id) ?? [];
    list.push(c);
    byClub.set(c.club_id, list);
  }

  const result: DirectoryClub[] = [];
  for (const club of clubs) {
    const list = byClub.get(club.id);
    const city = club.city?.trim();
    if (!list?.length || !city || pausedIds.has(club.id)) continue;
    const slug = citySlug(city);
    if (!slug) continue;
    const sports = SPORT_ORDER.filter((s) => list.some((c) => c.sport === s));
    const prices = list.map((c) => Number(c.price_per_hour)).filter((p) => p > 0);
    result.push({
      id: club.id,
      name: club.name,
      slug: club.slug,
      description: club.description,
      address: club.address,
      city,
      citySlug: slug,
      logo_url: club.logo_url,
      cover_url: club.cover_url,
      sports,
      courts: list.length,
      indoor: list.some((c) => c.is_indoor),
      priceFrom: prices.length ? Math.min(...prices) : null,
      art: { sport: list[0].sport as Sport, surface: list[0].surface as Surface, color: list[0].color },
    });
  }
  // Bigger clubs first, then by name.
  return result.sort((a, b) => b.courts - a.courts || a.name.localeCompare(b.name));
}

/** The cities with clubs, most clubs first. A city's name is its most common spelling. */
export function citiesOf(clubs: DirectoryClub[]): DirectoryCity[] {
  const map = new Map<string, { names: Map<string, number>; clubs: number; sports: Set<Sport> }>();
  for (const c of clubs) {
    const entry = map.get(c.citySlug) ?? { names: new Map(), clubs: 0, sports: new Set<Sport>() };
    entry.names.set(c.city, (entry.names.get(c.city) ?? 0) + 1);
    entry.clubs++;
    c.sports.forEach((s) => entry.sports.add(s));
    map.set(c.citySlug, entry);
  }
  return [...map.entries()]
    .map(([slug, e]) => ({
      slug,
      name: [...e.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
      clubs: e.clubs,
      sports: SPORT_ORDER.filter((s) => e.sports.has(s)),
    }))
    .sort((a, b) => b.clubs - a.clubs || a.name.localeCompare(b.name));
}

/** The site's address, for the sitemap and canonical links. */
export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL ?? "https://raqhub.com").replace(/\/+$/, "");
