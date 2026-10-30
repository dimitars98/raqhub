import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import CoachFilters from "@/components/coaches/CoachFilters";
import Avatar from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";
import { getLabels } from "@/lib/getLabels";
import { BADGE, levelTone } from "@/lib/badges";
import type { Coach } from "@/types/database";
import ArrowButton from "../ui/ArrowButton";

export type CoachWithJoins = Coach & {
  profile?: { full_name: string | null; avatar_url: string | null } | null;
  club?: { name: string; city: string | null } | null;
};

/**
 * The list of active coaches with a level filter. Used by the players' page
 * (/coaches, inside the app) and the public page (/findcoaches), which is a
 * little roomier.
 */
export default async function CoachDirectory({
  level,
  basePath,
  roomy = false,
}: {
  /** "all" or a level from the URL. */
  level: string;
  /** Page the filter links point to. */
  basePath: string;
  roomy?: boolean;
}) {
  const t = await getTranslations("coachesList");
  const labels = await getLabels();
  const supabase = await createClient();

  let query = supabase
    .from("coaches")
    .select(
      "*, profile:profiles(full_name, avatar_url), club:clubs(name, city)",
    )
    .eq("is_active", true)
    .order("price_per_hour");
  if (level !== "all") query = query.contains("levels", [level]);

  const { data } = await query;
  const coaches = (data ?? []) as CoachWithJoins[];

  return (
    <>
      <div className={roomy ? "mb-8" : "mb-6"}>
        <h1
          className={
            roomy
              ? "mb-2 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl"
              : "mb-1 text-2xl font-bold tracking-tight text-ink-900"
          }
        >
          {t("title")}
        </h1>
        <p
          className={roomy ? "text-base text-ink-600" : "text-sm text-ink-600"}
        >
          {t("count", { n: coaches.length })}
        </p>
      </div>

      <Suspense fallback={<div className="mb-7 h-10" />}>
        <CoachFilters basePath={basePath} />
      </Suspense>

      {!coaches.length ? (
        <div className={`card px-6 text-center ${roomy ? "py-20" : "py-16"}`}>
          <p className="mb-1 text-base font-semibold text-ink-900">
            {t("empty")}
          </p>
          <p className="text-sm text-ink-600">{t("emptyHint")}</p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 ${
            roomy
              ? "gap-5 sm:grid-cols-2 lg:grid-cols-3"
              : "gap-4 md:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {coaches.map((coach) => (
            <Link
              key={coach.id}
              href={`/coaches/${coach.id}`}
              className={`card group flex flex-col transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-lg hover:shadow-ink-900/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                roomy ? "p-6" : "p-5"
              }`}
            >
              {/* Photo and name */}
              <div
                className={`flex items-center ${roomy ? "mb-5 gap-4" : "mb-4 gap-3.5"}`}
              >
                <Avatar
                  id={coach.id}
                  name={coach.profile?.full_name}
                  src={coach.profile?.avatar_url}
                  className={roomy ? "size-14 text-base" : "size-12 text-sm"}
                  px={roomy ? 56 : 48}
                />
                <div className="min-w-0">
                  <div
                    className={`truncate font-semibold leading-snug text-ink-900 ${
                      roomy ? "text-lg" : "text-base"
                    }`}
                  >
                    {coach.profile?.full_name ?? t("coach")}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-600">
                    {coach.club?.city && (
                      <MapPin
                        size={14}
                        className="shrink-0 text-ink-400"
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">
                      {coach.club?.name ?? t("independent")}
                      {coach.club?.city ? ` · ${coach.club.city}` : ""}
                    </span>
                  </div>
                </div>
              </div>

              {coach.bio && (
                <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-ink-600">
                  {coach.bio}
                </p>
              )}

              {coach.levels?.length > 0 && (
                <div
                  className={`flex flex-wrap gap-1.5 ${roomy ? "mb-5" : "mb-4"}`}
                >
                  {coach.levels.map((l) => (
                    <span key={l} className={`${BADGE} py-1 ${levelTone(l)}`}>
                      {labels.level(l)}
                    </span>
                  ))}
                </div>
              )}

              {/* Price and "view profile". mt-auto lines the footers up across a row. */}
              <div className="mt-auto flex items-center justify-between border-t border-ink-100 pt-4">
                <span
                  className={`font-bold tracking-tight text-ink-900 ${roomy ? "text-xl" : "text-lg"}`}
                >
                  €{coach.price_per_hour}
                  <span className="text-sm font-normal tracking-normal text-ink-600">
                    {" "}
                    {t("perHour")}
                  </span>
                </span>
                <ArrowButton>{t("viewProfile")}</ArrowButton>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
