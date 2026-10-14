"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { TONES } from "@/types/tones";
import { LEVELS } from "@/lib/labels";
import { useLabels } from "@/hooks/useLabels";

/** Level filter for a coach list. `basePath` is the page it sits on. */
export default function CoachFilters({ basePath = "/coaches" }: { basePath?: string }) {
  const t = useTranslations("coachesList");
  const labels = useLabels();
  const searchParams = useSearchParams();
  const level = searchParams.get("level") ?? "all";
  // Coach lists are for players, so they always use the player tone.
  const tone = TONES.member;

  return (
    <nav aria-label={t("filterByLevel")} className="mb-7 flex flex-wrap gap-2">
      {(["all", ...LEVELS] as const).map((l) => {
        const active = level === l;
        return (
          <Link
            key={l}
            href={l === "all" ? basePath : `${basePath}?level=${l}`}
            aria-current={active ? "true" : undefined}
            className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
              active
                ? tone.active
                : "border-ink-200 text-ink-600 hover:border-ink-900 hover:text-ink-900"
            }`}
          >
            {l === "all" ? t("allLevels") : labels.level(l)}
          </Link>
        );
      })}
    </nav>
  );
}
