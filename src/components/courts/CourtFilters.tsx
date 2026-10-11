"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const SURFACES = [
  "all",
  "clay",
  "hard",
  "grass",
  "artificial_grass",
  "carpet",
] as const;
const SURFACE_LABEL: Record<string, string> = {
  all: "All surfaces",
  clay: "Clay",
  hard: "Hard",
  grass: "Grass",
  artificial_grass: "Artificial grass",
  carpet: "Carpet",
};

function buildHref(params: { surface?: string; indoor?: string }) {
  const p = new URLSearchParams();
  if (params.surface && params.surface !== "all")
    p.set("surface", params.surface);
  if (params.indoor) p.set("indoor", params.indoor);
  const qs = p.toString();
  return `/courts${qs ? `?${qs}` : ""}`;
}

export default function CourtFilters() {
  const searchParams = useSearchParams();
  const surface = searchParams.get("surface") ?? "all";
  const indoor = searchParams.get("indoor") ?? "";

  return (
    <div className="flex gap-2 flex-wrap mb-7">
      {SURFACES.map((s) => (
        <Link
          key={s}
          href={buildHref({ surface: s, indoor: indoor || undefined })}
          className={`text-xs px-4 py-2 rounded-full border transition-colors ${
            surface === s
              ? "bg-orange-400 text-white border-orange-400"
              : "border-orange-200 text-orange-700 hover:bg-orange-50"
          }`}
        >
          {SURFACE_LABEL[s]}
        </Link>
      ))}
      <Link
        href={buildHref({ surface, indoor: indoor === "1" ? undefined : "1" })}
        className={`text-xs px-4 py-2 rounded-full border transition-colors ${
          indoor === "1"
            ? "bg-orange-400 text-white border-orange-400"
            : "border-orange-200 text-orange-700 hover:bg-orange-50"
        }`}
      >
        Indoor only
      </Link>
    </div>
  );
}
