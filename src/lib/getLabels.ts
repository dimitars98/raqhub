import { getTranslations } from "next-intl/server";
import { makeLabels } from "@/lib/labels";

/** Translated sport, surface, level and status names for server components. */
export async function getLabels() {
  return makeLabels(await getTranslations("labels"));
}
