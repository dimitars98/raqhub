"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { makeLabels } from "@/lib/labels";

/** Translated sport, surface, level and status names for client components. */
export function useLabels() {
  const t = useTranslations("labels");
  return useMemo(() => makeLabels(t), [t]);
}
