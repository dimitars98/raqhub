// The fixed lists the app works with (sports, surfaces, levels, statuses),
// their display order, and their translated names. Translations live in the
// "labels" group of src/messages/*.json.
//
//   Client components:  const labels = useLabels();      (src/hooks/useLabels.ts)
//   Server components:  const labels = await getLabels(); (src/lib/getLabels.ts)
//   then:               labels.sport("padel"), labels.surface(court.surface) …

import type {
  BillingPeriod,
  BookingStatus,
  Level,
  MemberStatus,
  Sport,
  Surface,
} from "@/types/database";

export const SPORTS: Sport[] = ["tennis", "padel", "pickleball"];

export const SURFACES: Surface[] = [
  "clay",
  "hard",
  "grass",
  "artificial_grass",
  "carpet",
  "concrete",
  "acrylic",
];

/** Surfaces offered when adding a court for each sport. */
export const SURFACES_BY_SPORT: Record<Sport, Surface[]> = {
  tennis: ["clay", "hard", "grass", "artificial_grass", "carpet"],
  padel: ["artificial_grass", "carpet", "hard"],
  pickleball: ["hard", "concrete", "acrylic", "carpet"],
};

export const LEVELS: Level[] = ["beginner", "intermediate", "advanced", "junior", "adult"];

export const BOOKING_STATUSES: BookingStatus[] = [
  "confirmed",
  "pending",
  "completed",
  "cancelled",
  "no_show",
];

export const MEMBER_STATUSES: MemberStatus[] = ["active", "cancelled", "expired"];

export const BILLING_PERIODS: BillingPeriod[] = ["monthly", "annual", "one_time"];

export const SPORT_EMOJI: Record<Sport, string> = {
  tennis: "🎾",
  padel: "🏓",
  pickleball: "🥒",
};

/** The part of a next-intl translator this file needs (scoped to "labels"). */
type LabelsTranslator = {
  (key: string): string;
  has(key: string): boolean;
};

/**
 * Translated names. Values that aren't in the list (old data, a typo in the
 * database) are shown as they are instead of a missing-translation key.
 */
export function makeLabels(t: LabelsTranslator) {
  const name = (group: string) => (value: string | null | undefined) => {
    if (!value) return "";
    const key = `${group}.${value}`;
    return t.has(key) ? t(key) : value;
  };
  return {
    sport: name("sports"),
    surface: name("surfaces"),
    level: name("levels"),
    bookingStatus: name("bookingStatus"),
    memberStatus: name("memberStatus"),
    billingPeriod: name("billingPeriod"),
    /** "Indoor" / "Outdoor" */
    inOut: (isIndoor: boolean | null | undefined) => t(isIndoor ? "indoor" : "outdoor"),
  };
}

export type Labels = ReturnType<typeof makeLabels>;
