// Colours for status pills and tags, so the same status looks the same on
// every screen. Combine with BADGE: className={`${BADGE} ${BOOKING_STATUS_TONE[s]}`}

import type { BookingStatus, Level, MemberStatus, Surface } from "@/types/database";
import type { TournamentStatus } from "@/lib/tournament";

/** Shape of every pill. */
export const BADGE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export const BOOKING_STATUS_TONE: Record<BookingStatus, string> = {
  confirmed: "bg-brand-100 text-brand-800",
  pending: "bg-court-100 text-court-800",
  completed: "bg-ink-100 text-ink-800",
  cancelled: "bg-ink-50 text-ink-400",
  no_show: "bg-red-100 text-red-700",
};

/** Solid colour per booking status, for charts (hex) and small dots. */
export const BOOKING_STATUS_HEX: Record<BookingStatus, string> = {
  confirmed: "#7aad12",
  pending: "#378add",
  completed: "#3d4f35",
  cancelled: "#d0d9c9",
  no_show: "#f87171",
};

export const BOOKING_STATUS_DOT: Record<BookingStatus, string> = {
  confirmed: "bg-[#7aad12]",
  pending: "bg-[#378add]",
  completed: "bg-[#3d4f35]",
  cancelled: "bg-[#6e7f65]",
  no_show: "bg-red-400",
};

export const MEMBER_STATUS_TONE: Record<MemberStatus, string> = {
  active: "bg-brand-100 text-brand-800",
  cancelled: "bg-ink-50 text-ink-400",
  expired: "bg-red-100 text-red-700",
};

export const LEVEL_TONE: Record<Level, string> = {
  beginner: "bg-brand-50 text-brand-800",
  intermediate: "bg-accent-100 text-accent-800",
  advanced: "bg-court-50 text-court-800",
  junior: "bg-ink-50 text-ink-800",
  adult: "bg-ink-50 text-ink-800",
};

export const SURFACE_TONE: Partial<Record<Surface, string>> = {
  clay: "bg-amber-100 text-amber-800",
  hard: "bg-court-100 text-court-800",
  grass: "bg-brand-100 text-brand-800",
  artificial_grass: "bg-brand-50 text-brand-700",
  carpet: "bg-stone-100 text-stone-700",
};

export const TOURNAMENT_STATUS_TONE: Record<TournamentStatus, string> = {
  open: "bg-brand-100 text-brand-800",
  closed: "bg-accent-100 text-accent-800",
  started: "bg-court-100 text-court-800",
  finished: "bg-ink-100 text-ink-600",
};

/** For values not in the lists above. */
export const NEUTRAL_TONE = "bg-ink-50 text-ink-800";

export const bookingStatusTone = (status: string) =>
  BOOKING_STATUS_TONE[status as BookingStatus] ?? NEUTRAL_TONE;
export const memberStatusTone = (status: string) =>
  MEMBER_STATUS_TONE[status as MemberStatus] ?? NEUTRAL_TONE;
export const levelTone = (level: string) => LEVEL_TONE[level as Level] ?? NEUTRAL_TONE;
export const surfaceTone = (surface: string) =>
  SURFACE_TONE[surface as Surface] ?? "bg-brand-50 text-brand-600";
