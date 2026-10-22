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
  admin: ["bookings", "lessons", "cancellations", "groups", "tournaments", "members", "staff"],
  member: ["club_changes", "reminders", "groups", "tournaments", "membership"],
};
/** Switches only the club owner sees. */
export const OWNER_ONLY = ["staff"];

/** Filters on the notifications page, and the kinds each one shows. */
export const FILTERS: Record<Area, Record<string, string[]>> = {
  admin: {
    bookings: ["booking_new", "lesson_new", "booking_cancelled"],
    members: ["members_ending", "staff_joined"],
    groups: ["group_signup", "group_left", "group_offer_answer", "group_absence"],
    tournaments: ["tournament_joined", "tournament_left"],
  },
  member: {
    bookings: ["club_booked", "club_cancelled", "reminder", "lesson_new", "booking_new", "booking_cancelled"],
    groups: ["group_cancelled", "group_added", "group_fee_due", "group_offer", "group_signup", "group_absence"],
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
  club_booked: "blue",
  group_signup: "lime",
  group_offer: "lime",
  group_offer_answer: "lime",
  group_cancelled: "amber",
  group_fee_due: "amber",
  group_added: "blue",
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
