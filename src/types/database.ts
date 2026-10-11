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
  is_active: boolean;
  owner_id: string | null;
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
