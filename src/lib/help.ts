import type { Area } from "@/lib/notifications";

// The help panel (src/components/layout/Help.tsx): which answers each page
// shows first. The questions and answers live in the "help.topics" group of
// src/messages/*.json, keyed by the ids below.

/** Admin pages, by the part of the path after /admin/. */
const ADMIN_PAGES: Record<string, string[]> = {
  timetable: ["tt_read", "tt_add", "ct_close", "tt_days", "bk_weekly"],
  bookings: ["tt_add", "bk_weekly", "bk_cancel", "bk_noshow", "bk_export"],
  dashboard: ["db_numbers", "db_share", "ga_plan"],
  members: ["mb_add", "mb_discount", "mb_bulk", "mb_ending"],
  plans: ["pl_create", "mb_discount", "mb_add"],
  coaches: ["co_add", "co_lessons"],
  groups: ["gr_create", "gr_register", "gr_fees", "gr_waiting"],
  matches: ["om_what", "om_release", "om_levels"],
  courts: ["ct_add", "ct_close", "ct_off", "ct_price"],
  tournaments: ["tn_create", "tn_draw"],
  analytics: ["an_read"],
  settings: ["st_hours", "st_rules", "bk_noshow", "st_delete"],
  staff: ["sf_invite", "sf_can"],
  share: ["sh_link", "db_share"],
  notifications: ["ga_notifications"],
};

/** Player pages, by the first part of the path. */
const MEMBER_PAGES: Record<string, string[]> = {
  book: ["pb_book", "pb_pay", "pb_closed"],
  "my-bookings": ["pm_cancel", "pm_calendar", "pm_noshow"],
  coaches: ["pc_lesson", "pb_pay"],
  groups: ["pg_where", "pg_absent", "pg_fees"],
  matches: ["pom_join", "pom_start", "pom_level", "pom_release", "pom_leave"],
  profile: ["pp_name", "pp_membership"],
  membership: ["pp_membership", "pb_pay"],
  notifications: ["pgen_notifications"],
};

/** Shown under "Good to know" on every page. */
const GENERAL: Record<Area, string[]> = {
  admin: ["ga_plan", "ga_language", "ga_notifications"],
  member: ["pgen_language", "pgen_notifications"],
};

const PAGES: Record<Area, Record<string, string[]>> = { admin: ADMIN_PAGES, member: MEMBER_PAGES };

// "/de/admin/groups/12" → ["admin", "groups", "12"]
const LOCALE = /^\/[a-z]{2}(?=\/|$)/;

/** The answers for the page at this path, most useful first. */
export function topicsForPage(pathname: string, area: Area): string[] {
  const parts = pathname.replace(LOCALE, "").split("/").filter(Boolean);
  const key = area === "admin" ? parts[parts[0] === "admin" ? 1 : 0] : parts[0];
  return (key && PAGES[area][key]) || [];
}

/** "Good to know", without what the page already shows. */
export function generalTopics(area: Area, shown: string[]): string[] {
  return GENERAL[area].filter((id) => !shown.includes(id));
}

/** Every answer someone in this area can search. */
export function allTopics(area: Area): string[] {
  return [...new Set([...Object.values(PAGES[area]).flat(), ...GENERAL[area]])];
}

/** Lower case without accents, so "cancelacion" finds "cancelación". */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
