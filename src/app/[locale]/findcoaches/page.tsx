import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/layout/Navbar";
import CoachFilters from "@/components/coaches/CoachFilters";
import { createClient } from "@/lib/supabase/server";
import type { Coach } from "@/types/database";

type CoachWithJoins = Coach & {
  profile?: { full_name: string | null; avatar_url: string | null } | null;
  club?: { name: string; city: string | null } | null;
};

// Only colors that exist in the theme
const AVATAR_COLORS = [
  "bg-brand-100 text-brand-900",
  "bg-court-100 text-court-800",
  "bg-accent-100 text-accent-800",
  "bg-ink-100 text-ink-800",
];

const LEVEL_STYLE: Record<string, string> = {
  beginner: "bg-brand-50 text-brand-800",
  intermediate: "bg-accent-100 text-accent-800",
  advanced: "bg-court-50 text-court-800",
  professional: "bg-ink-900 text-white",
};

const initials = (name: string | null) =>
  (name ?? "C")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Same coach always gets the same color, whatever the filter or order
const avatarColorFor = (id: string) => {
  let sum = 0;
  for (const ch of String(id)) sum += ch.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level = "all" } = await searchParams;
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
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-10 lg:py-14">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink-900 mb-2">
            Coaches
          </h1>
          <p className="text-base text-ink-600">
            {coaches.length} coach{coaches.length !== 1 ? "es" : ""} available
          </p>
        </div>

        {/* Filters */}
        <Suspense fallback={<div className="h-10 mb-8" />}>
          <CoachFilters />
        </Suspense>

        {/* Empty state */}
        {!coaches.length ? (
          <div className="card px-6 py-20 text-center">
            <p className="text-lg font-semibold text-ink-900 mb-1">
              No coaches match your filters
            </p>
            <p className="text-sm text-ink-600">
              Try a different level to see more coaches.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {coaches.map((coach) => {
              const name = coach.profile?.full_name ?? "Coach";

              return (
                <Link
                  key={coach.id}
                  href={`/coaches/${coach.id}`}
                  className="card group flex flex-col p-6 transition-all duration-150 hover:-translate-y-0.5 hover:border-ink-900 hover:shadow-lg hover:shadow-ink-900/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                >
                  {/* Avatar + name row */}
                  <div className="flex items-center gap-4 mb-5">
                    {coach.profile?.avatar_url ? (
                      <img
                        src={coach.profile.avatar_url}
                        alt=""
                        className="size-14 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className={`size-14 rounded-full flex items-center justify-center text-base font-semibold shrink-0 ${avatarColorFor(coach.id)}`}
                      >
                        {initials(coach.profile?.full_name ?? null)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-lg font-semibold leading-snug text-ink-900 truncate">
                        {name}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-ink-600 mt-0.5">
                        {coach.club?.city && (
                          <MapPin
                            size={14}
                            className="shrink-0 text-ink-400"
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate">
                          {coach.club?.name ?? "Independent"}
                          {coach.club?.city ? ` · ${coach.club.city}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  {coach.bio && (
                    <p className="text-sm text-ink-600 mb-4 line-clamp-2 leading-relaxed">
                      {coach.bio}
                    </p>
                  )}

                  {/* Level badges */}
                  {coach.levels?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {coach.levels.map((l) => (
                        <span
                          key={l}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium capitalize ${
                            LEVEL_STYLE[l] ?? "bg-ink-50 text-ink-800"
                          }`}
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer — price + CTA hint. mt-auto lines footers up across a row. */}
                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-ink-100">
                    <span className="text-xl font-bold tracking-tight text-ink-900">
                      €{coach.price_per_hour}
                      <span className="text-sm font-normal tracking-normal text-ink-600">
                        {" "}
                        / hr
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-900">
                      View profile
                      <span
                        aria-hidden="true"
                        className="transition-transform duration-150 group-hover:translate-x-1"
                      >
                        →
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
