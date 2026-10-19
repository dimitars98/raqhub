export type Role = "player" | "coach" | "club_admin" | "super_admin";
export type Sport = "tennis" | "padel" | "pickleball";

export type Surface =
  | "clay"
  | "hard"
  | "grass"
  | "artificial_grass"
  | "carpet"
  | "concrete"
  | "acrylic";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";
export type Level =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "junior"
  | "adult";
export type MemberStatus = "active" | "cancelled" | "expired";
export type BillingPeriod = "monthly" | "annual" | "one_time";

export interface MembershipPlan {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: BillingPeriod;
  discount_pct: number;
  created_at: string;
}

export interface Member {
  id: string;
  club_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  plan_id: string | null;
  status: MemberStatus;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  plan?: MembershipPlan | null;
}

// One row of the my_memberships() database function: the signed-in player's
// own membership, without the club's private notes.
export type MyMembership = Omit<Member, "notes" | "plan"> & {
  club: Pick<Club, "id" | "name">;
  plan: MembershipPlan | null;
};

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: Role;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}
/** One weekday's opening hours, times as "HH:MM". */
export type DayHours = { open: boolean; from: string; to: string };
export type OpeningHours = DayHours[];

export interface Club {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  cover_url: string | null;
  /** Seven days, Monday first. Null = not set (07:00 to 22:00 every day). */
  opening_hours: OpeningHours | null;
  /** Booking rules (see src/lib/bookingRules.ts). Null = defaults. */
  booking_rules: unknown;
  is_active: boolean;
  owner_id: string | null;
  /** ServeTime plan: starter / club / academy. Only changed by you. */
  plan: "starter" | "club" | "academy";
  /** End of the free trial. */
  trial_ends_at: string | null;
  /** Last day the club has paid for (null = not paid yet). */
  paid_until: string | null;
  created_at: string;
  updated_at: string;
}
export interface Court {
  id: string;
  club_id: string;
  name: string;
  surface: Surface;
  sport: Sport;
  is_indoor: boolean;
  is_active: boolean;
  price_per_hour: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  club?: Club;
}
export interface Coach {
  id: string;
  profile_id: string;
  club_id: string | null;
  bio: string | null;
  specializations: string[];
  levels: Level[];
  price_per_hour: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  club?: Club;
}
export interface Booking {
  id: string;
  player_id: string | null; // was string, now nullable
  member_id: string | null; // new
  walk_in_name: string | null; // new
  court_id: string | null;
  coach_id: string | null;
  starts_at: string;
  ends_at: string;
  duration_min: number;
  status: BookingStatus;
  total_price: number;
  notes: string | null;
  reference: string;
  stripe_payment_intent_id: string | null;
  checked_in_at: string | null;
  /** When the 24-hour reminder email went out. */
  reminder_sent_at?: string | null;
  /** Language the player booked in, used for their emails. */
  locale?: string | null;
  /** Shared by the weeks of a weekly repeating booking. */
  series_id?: string | null;
  created_at: string;
  updated_at: string;
  player?: Profile;
  court?: Court;
  coach?: Coach;
  member?: Member; // new
}
export interface Availability {
  id: string;
  court_id: string | null;
  coach_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// Typed row maps used for explicit casting (until supabase gen types is run)
export type Tables = {
  profiles: Profile;
  clubs: Club;
  courts: Court;
  coaches: Coach;
  bookings: Booking;
  availability: Availability;
  membership_plans: MembershipPlan;
  members: Member;
};

// Minimal Database type — replace with generated after connecting Supabase
export type Database = {
  public: {
    Tables: {
      [K in keyof Tables]: {
        Row: Tables[K];
        Insert: Partial<Tables[K]>;
        Update: Partial<Tables[K]>;
      };
    };
  };
};

export interface Tournament {
  id: string;
  club_id: string;
  name: string;
  sport: Sport;
  starts_on: string;
  description: string | null;
  max_entries: number;
  entry_fee: number | null;
  status: "open" | "closed" | "started" | "finished";
  created_at: string;
}

export interface TournamentEntry {
  id: string;
  tournament_id: string;
  /** Player's name, or "Ana / Marko" for doubles. */
  name: string;
  /** Set when a player signed up themselves. */
  player_id: string | null;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  entry1_id: string | null;
  entry2_id: string | null;
  winner_id: string | null;
  score: string | null;
}

/** Someone the club owner invited as staff (supabase/migrations/20261020_staff.sql). */
export interface ClubStaff {
  id: string;
  club_id: string;
  email: string;
  /** Set once they have signed in with that email. */
  user_id: string | null;
  created_at: string;
  accepted_at: string | null;
}
