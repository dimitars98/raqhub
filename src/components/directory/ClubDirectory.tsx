import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import { LogoMark } from "@/components/ui/Logo";
import CourtArt from "@/components/courts/CourtArt";
import { getLabels } from "@/lib/getLabels";
import { initials } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";
import { siteUrl, type DirectoryCity, type DirectoryClub } from "@/lib/directory";
import type { Sport } from "@/types/database";

const SPORTS: Sport[] = ["padel", "tennis", "pickleball"];

type Props = {
  /** The clubs to show (already in this city, if there is one). */
  clubs: DirectoryClub[];
  /** Every city, for the list on the main page. Omitted on a city page. */
  cities?: DirectoryCity[];
  /** The city page this is, if any. */
  city?: DirectoryCity;
  sport: Sport | null;
};

// The public directory of clubs (/courts) and one city's clubs (/courts/skopje):
// what a player finds on Google when they search for a court in their city.
export default async function ClubDirectory({ clubs, cities, city, sport }: Props) {
  const t = await getTranslations("directory");
  const labels = await getLabels();
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const base = city ? `/courts/${city.slug}` : "/courts";
  const shown = sport ? clubs.filter((c) => c.sports.includes(sport)) : clubs;
  // Only the sports some club here offers.
  const sports = SPORTS.filter((s) => clubs.some((c) => c.sports.includes(s)));

  // Search engines: the list of clubs, each a place where the sport is played.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: city ? t("titleCity", { city: city.name }) : t("titleAll"),
    itemListElement: shown.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SportsActivityLocation",
        name: c.name,
        url: `${siteUrl()}/${locale}/clubs/${c.slug}`,
        address: {
          "@type": "PostalAddress",
          ...(c.address ? { streetAddress: c.address } : {}),
          addressLocality: c.city,
        },
        ...(c.cover_url || c.logo_url ? { image: c.cover_url ?? c.logo_url } : {}),
        ...(c.priceFrom ? { priceRange: `€${c.priceFrom}+` } : {}),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Built from the clubs above; "<" is escaped so no text can close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className="sticky top-0 z-50 border-b border-ink-100 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-brand-900"
          >
            <LogoMark className="size-7" />
            RaqHub
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher size="sm" />
            {!user && (
              <Link href="/login" className="btn-ghost whitespace-nowrap">
                {t("signIn")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
        {city && (
          <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-ink-600">
            <Link href="/courts" className="hover:text-ink-900 hover:underline">
              {t("allCities")}
            </Link>
            <span aria-hidden="true" className="mx-2 text-ink-400">/</span>
            <span className="text-ink-900">{city.name}</span>
          </nav>
        )}

        <h1 className="mb-3 max-w-3xl text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
          {city ? t("titleCity", { city: city.name }) : t("titleAll")}
        </h1>
        <p className="mb-8 max-w-2xl text-base leading-relaxed text-ink-600">
          {city ? t("introCity", { city: city.name, n: clubs.length }) : t("introAll")}
        </p>

        {cities && cities.length > 0 && (
          <section aria-labelledby="cities" className="mb-10">
            <h2 id="cities" className="mb-3 text-sm font-semibold text-ink-900">
              {t("cities")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/courts/${c.slug}`}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-ink-200 bg-white px-4 text-sm font-medium text-ink-900 transition-colors hover:border-ink-400"
                  >
                    <MapPin size={14} aria-hidden="true" className="text-ink-400" />
                    {c.name}
                    <span className="text-ink-400">{t("clubsCount", { n: c.clubs })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sports.length > 1 && (
          <nav aria-label={t("sportFilter")} className="-mx-6 mb-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0">
            {[null, ...sports].map((s) => {
              const on = s === sport;
              return (
                <Link
                  key={s ?? "all"}
                  href={s ? `${base}?sport=${s}` : base}
                  aria-current={on ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    on
                      ? "border-brand-900 bg-brand-900 text-white"
                      : "border-ink-100 bg-white text-ink-600 hover:border-ink-200"
                  }`}
                >
                  {s ? labels.sport(s) : t("allSports")}
                </Link>
              );
            })}
          </nav>
        )}

        {shown.length === 0 ? (
          <p className="rounded-2xl border border-ink-100 bg-white px-6 py-14 text-center text-sm text-ink-600">
            {clubs.length ? t("noClubsSport") : t("noClubs")}
          </p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-5">
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clubs/${c.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white transition-all hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-[0_12px_28px_-14px_rgba(17,28,10,0.35)] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                >
                  <div className="relative h-36 w-full overflow-hidden">
                    {c.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <CourtArt court={c.art} />
                    )}
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                      {c.sports.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm"
                        >
                          {labels.sport(s)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.logo_url}
                          alt=""
                          loading="lazy"
                          className="size-10 shrink-0 rounded-xl border border-ink-100 object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-900"
                        >
                          {initials(c.name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-bold text-ink-900">{c.name}</h3>
                        <p className="truncate text-[13px] text-ink-600">
                          {[c.address, city ? null : c.city].filter(Boolean).join(", ") || c.city}
                        </p>
                      </div>
                    </div>

                    <p className="text-[13px] text-ink-600">
                      {t("courts", { n: c.courts })}
                      {c.indoor && <> · {t("indoor")}</>}
                      {c.priceFrom !== null && (
                        <>
                          {" · "}
                          <span className="font-semibold text-ink-900">{t("from", { price: c.priceFrom })}</span>
                        </>
                      )}
                    </p>

                    <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800 group-hover:text-ink-900">
                      {t("viewClub")}
                      <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* For club owners who land here */}
        <section className="mt-14 flex flex-col items-start gap-4 rounded-3xl bg-ink-900 p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {city ? t("forClubsTitleCity", { city: city.name }) : t("forClubsTitle")}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-white/70">{t("forClubsText")}</p>
          </div>
          <Link
            href="/signup?role=admin"
            className="inline-flex h-12 shrink-0 items-center rounded-full bg-brand-400 px-6 text-sm font-semibold text-ink-900 transition-colors hover:bg-white"
          >
            {t("forClubsCta")}
          </Link>
        </section>
      </main>
    </>
  );
}
