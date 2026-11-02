import type { MetadataRoute } from "next";
import { citiesOf, loadDirectory, siteUrl, visitorClient } from "@/lib/directory";
import { routing } from "@/i18n/routing";

// Tells search engines which public pages exist, in every language.
// Rebuilt at most once an hour.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const clubs = await loadDirectory();
  const events = await loadEvents(clubs.map((c) => c.id));
  const paths = [
    { path: "", priority: 1 },
    { path: "/courts", priority: 0.9 },
    ...citiesOf(clubs).map((c) => ({ path: `/courts/${c.slug}`, priority: 0.8 })),
    ...clubs.map((c) => ({ path: `/clubs/${c.slug}`, priority: 0.7 })),
    ...events.map((path) => ({ path, priority: 0.6 })),
    { path: "/privacy", priority: 0.2 },
    { path: "/terms", priority: 0.2 },
  ];

  return paths.flatMap(({ path, priority }) =>
    routing.locales.map((locale) => ({
      url: `${site}/${locale}${path}`,
      changeFrequency: "weekly" as const,
      priority,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, `${site}/${l}${path}`])),
      },
    })),
  );
}

/**
 * The public pages of the listed clubs' leagues, tournaments and Americano
 * evenings, newest first. Empty if the database can't be reached.
 */
async function loadEvents(clubIds: string[]): Promise<string[]> {
  if (!clubIds.length) return [];
  try {
    const db = visitorClient();
    const [leagues, tournaments, evenings] = await Promise.all([
      db.from("leagues").select("id").in("club_id", clubIds).order("created_at", { ascending: false }).limit(300),
      db.from("tournaments").select("id").in("club_id", clubIds).order("created_at", { ascending: false }).limit(300),
      db.from("social_events").select("id").in("club_id", clubIds).order("created_at", { ascending: false }).limit(300),
    ]);
    return [
      ...(leagues.data ?? []).map((r) => `/leagues/${r.id}`),
      ...(tournaments.data ?? []).map((r) => `/tournaments/${r.id}`),
      ...(evenings.data ?? []).map((r) => `/americano/${r.id}`),
    ];
  } catch (error) {
    console.error("sitemap events failed:", error);
    return [];
  }
}
