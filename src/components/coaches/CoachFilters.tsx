"use client";

import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { TONES } from "@/types/tones";

const LEVELS = [
  "all",
  "beginner",
  "intermediate",
  "advanced",
  "junior",
  "adult",
] as const;

export default function CoachFilters() {
  const searchParams = useSearchParams();
  const level = searchParams.get("level") ?? "all";
  // This page is only shown to players, so it always uses the player tone.
  const tone = TONES.member;

  return (
    <nav aria-label="Filter by level" className="mb-7 flex flex-wrap gap-2">
      {LEVELS.map((l) => {
        const active = level === l;
        return (
          <Link
            key={l}
            href={l === "all" ? "/coaches" : `/coaches?level=${l}`}
            aria-current={active ? "true" : undefined}
            className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
              active
                ? tone.active
                : "border-ink-200 text-ink-600 hover:border-ink-900 hover:text-ink-900"
            }`}
          >
            {l === "all" ? "All levels" : l}
          </Link>
        );
      })}
    </nav>
  );
}
