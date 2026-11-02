import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import ClubDirectory from "@/components/directory/ClubDirectory";
import { citiesOf, citySlug, loadDirectory, siteUrl } from "@/lib/directory";
import { routing } from "@/i18n/routing";
import type { Sport } from "@/types/database";

const SPORTS: Sport[] = ["padel", "tennis", "pickleball"];

type PageProps = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ sport?: string }>;
};

async function load(slug: string) {
  const all = await loadDirectory();
  const clubs = all.filter((c) => c.citySlug === slug);
  const city = citiesOf(clubs)[0];
  return { clubs, city };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const { city } = await load(decodeURIComponent(slug));
  if (!city) return { title: "RaqHub" };
  const t = await getTranslations("directory");
  const locale = await getLocale();
  const path = `/courts/${city.slug}`;
  return {
    title: t("metaTitleCity", { city: city.name }),
    description: t("metaDescriptionCity", { city: city.name, n: city.clubs }),
    alternates: {
      canonical: `${siteUrl()}/${locale}${path}`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `${siteUrl()}/${l}${path}`])),
        "x-default": `${siteUrl()}/${routing.defaultLocale}${path}`,
      },
    },
  };
}

export default async function CityCourtsPage({ params, searchParams }: PageProps) {
  const { city: raw } = await params;
  const { sport } = await searchParams;
  const asked = decodeURIComponent(raw);
  // /courts/Скопје or /courts/Skopje → /courts/skopje
  const slug = citySlug(asked);
  if (slug && slug !== asked) {
    const locale = await getLocale();
    permanentRedirect(`/${locale}/courts/${slug}`);
  }

  const { clubs, city } = await load(slug);
  if (!city) notFound();

  return (
    <ClubDirectory
      clubs={clubs}
      city={city}
      sport={SPORTS.includes(sport as Sport) ? (sport as Sport) : null}
    />
  );
}
