import type { MetadataRoute } from "next";
import { citiesOf, loadDirectory, siteUrl } from "@/lib/directory";
import { routing } from "@/i18n/routing";

// Tells search engines which public pages exist, in every language.
// Rebuilt at most once an hour.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const clubs = await loadDirectory();
  const paths = [
    { path: "", priority: 1 },
    { path: "/courts", priority: 0.9 },
    ...citiesOf(clubs).map((c) => ({ path: `/courts/${c.slug}`, priority: 0.8 })),
    ...clubs.map((c) => ({ path: `/clubs/${c.slug}`, priority: 0.7 })),
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
