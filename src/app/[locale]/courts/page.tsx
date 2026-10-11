import Link from "next/link";
import { Suspense } from "react";
import Navbar from "@/components/layout/Navbar";
import CourtFilters from "@/components/courts/CourtFilters";
import { createClient } from "@/lib/supabase/server";
import type { Court } from "@/types/database";

const SURFACE_LABEL: Record<string, string> = {
  all: "All surfaces",
  clay: "Clay",
  hard: "Hard",
  grass: "Grass",
  artificial_grass: "Artificial grass",
  carpet: "Carpet",
};

export default async function CourtsPage({
  searchParams,
}: {
  searchParams: { surface?: string; indoor?: string };
}) {
  const supabase = await createClient();
  const surface = searchParams.surface ?? "all";
  const indoor = searchParams.indoor;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single()) as { data: { role: string } | null; error: unknown };

  const isAdmin =
    profile?.role === "club_admin" || profile?.role === "super_admin";

  let query = supabase
    .from("courts")
    .select("*, club:clubs(name, city)")
    .eq("is_active", true)
    .order("price_per_hour");

  if (surface !== "all") query = query.eq("surface", surface);
  if (indoor === "1") query = query.eq("is_indoor", true);

  const { data } = await query;
  const courts = (data ?? []) as (Court & {
    club?: { name: string; city: string | null } | null;
  })[];

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-medium text-orange-900 mb-1">Courts</h1>
        <p className="text-sm text-orange-600 mb-7">
          {courts.length} available
        </p>

        <Suspense fallback={<div className="h-10 mb-7" />}>
          <CourtFilters />
        </Suspense>

        {!courts.length ? (
          <div className="text-center py-16 text-orange-400 text-sm">
            No courts match your filters.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {courts.map((court) => (
              <Link
                key={court.id}
                href={
                  isAdmin ? `/admin/courts/${court.id}` : `/courts/${court.id}`
                }
                className="card px-5 py-4 flex items-center gap-4 hover:border-orange-300 transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-orange-900">
                    {court.name}
                  </div>
                  <div className="text-xs text-orange-400 mt-0.5 truncate">
                    {court.club?.name}
                    {court.club?.city ? ` · ${court.club.city}` : ""} ·{" "}
                    {SURFACE_LABEL[court.surface]} ·{" "}
                    {court.is_indoor ? "Indoor" : "Outdoor"}
                  </div>
                </div>
                <div className="text-sm font-medium text-orange-800">
                  €{court.price_per_hour}/hr
                </div>
                {!isAdmin && (
                  <span className="btn-primary text-xs py-1.5 px-4">Book</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
