// Notifications: what each kind is, which on/off switch it belongs to, and
// which filters show it. The rows themselves are made by the database (see
// supabase/migrations/20261022_notifications.sql); the app only reads them,
// marks them read and turns kind + data into text in the reader's language.

export type NotificationRow = {
  id: string;
  kind: string;
  data: Record<string, unknown>;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type Area = "admin" | "member";

/** On/off switches, in the order they're shown. "plan" is always on. */
export const CATEGORIES: Record<Area, string[]> = {
  admin: ["bookings", "lessons", "cancellations", "groups", "matches", "tournaments", "members", "staff"],
  member: ["club_changes", "reminders", "matches", "groups", "tournaments", "membership"],
};
/** Switches only the club owner sees. */
export const OWNER_ONLY = ["staff"];

/** Filters on the notifications page, and the kinds each one shows. */
export const FILTERS: Record<Area, Record<string, string[]>> = {
  admin: {
    bookings: ["booking_new", "lesson_new", "booking_cancelled"],
    members: ["members_ending", "staff_joined"],
    groups: ["group_signup", "group_left", "group_offer_answer", "group_absence"],
    matches: ["level_check"],
    tournaments: ["tournament_joined", "tournament_left"],
  },
  member: {
    bookings: ["club_booked", "club_cancelled", "court_closed", "reminder", "lesson_new", "booking_new", "booking_cancelled"],
    groups: ["group_cancelled", "group_added", "group_fee_due", "group_offer", "group_signup", "group_absence"],
    matches: [
      "match_joined",
      "match_request",
      "match_left",
      "match_full",
      "match_answer",
      "match_removed",
      "match_cancelled",
      "match_keep_ask",
      "match_released",
      "level_confirmed",
    ],
    tournaments: ["draw"],
    membership: ["membership_ending"],
  },
};

/** Colour of the little icon tile. */
export type Tone = "lime" | "blue" | "amber" | "dark" | "plain";

export const KIND_TONE: Record<string, Tone> = {
  booking_new: "lime",
  lesson_new: "blue",
  booking_cancelled: "amber",
  club_cancelled: "amber",
  court_closed: "amber",
  club_booked: "blue",
  group_signup: "lime",
  group_offer: "lime",
  group_offer_answer: "lime",
  group_cancelled: "amber",
  group_fee_due: "amber",
  group_added: "blue",
  match_joined: "lime",
  match_full: "lime",
  match_request: "blue",
  match_answer: "lime",
  match_left: "amber",
  match_removed: "amber",
  match_cancelled: "amber",
  match_keep_ask: "dark",
  match_released: "amber",
  level_check: "blue",
  level_confirmed: "lime",
  trial_ending: "dark",
  trial_ended: "dark",
};

export const TONE_CLASS: Record<Tone, string> = {
  lime: "bg-[#e4f7b8] text-[#2e4d03]",
  blue: "bg-[#e8f4fd] text-[#0c4478]",
  amber: "bg-[#fef3c7] text-[#92400e]",
  dark: "bg-[#111c0a] text-[#a8d832]",
  plain: "bg-[#f4f6f2] text-[#3d4f35]",
};

/** How many the bell shows; the page loads more as you scroll. */
export const BELL_SIZE = 12;
export const PAGE_SIZE = 30;
