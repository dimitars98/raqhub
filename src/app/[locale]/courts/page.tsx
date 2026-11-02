import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import ClubDirectory from "@/components/directory/ClubDirectory";
import { citiesOf, loadDirectory, siteUrl } from "@/lib/directory";
import { routing } from "@/i18n/routing";
import type { Sport } from "@/types/database";

const SPORTS: Sport[] = ["padel", "tennis", "pickleball"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  const locale = await getLocale();
  return {
    title: t("metaTitleAll"),
    description: t("metaDescriptionAll"),
    alternates: {
      canonical: `${siteUrl()}/${locale}/courts`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `${siteUrl()}/${l}/courts`])),
        "x-default": `${siteUrl()}/${routing.defaultLocale}/courts`,
      },
    },
  };
}

export default async function CourtsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>;
}) {
  const { sport } = await searchParams;
  const clubs = await loadDirectory();
  return (
    <ClubDirectory
      clubs={clubs}
      cities={citiesOf(clubs)}
      sport={SPORTS.includes(sport as Sport) ? (sport as Sport) : null}
    />
  );
}
