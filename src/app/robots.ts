import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/directory";
import { routing } from "@/i18n/routing";

// Public pages may be indexed; signed-in areas and the API may not.
export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/admin", "/dashboard", "/book", "/my-bookings", "/membership", "/profile", "/notifications"];
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...routing.locales.flatMap((l) => privatePaths.map((p) => `/${l}${p}`))],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
