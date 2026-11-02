export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          coach_id: string | null
          court_id: string | null
          day_of_week: number | null
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
        }
        Insert: {
          coach_id?: string | null
          court_id?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
        }
        Update: {
          coach_id?: string | null
          court_id?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          payment_status: string
          pay_by: string | null
          paid_at: string | null
          amount_paid: number | null
          refunded_at: string | null
          stripe_checkout_session_id: string | null
          stripe_account_id: string | null
          checked_in_at: string | null
          coach_id: string | null
          court_id: string | null
          created_at: string | null
          duration_min: number
          ends_at: string
          id: string
          locale: string | null
          member_id: string | null
          notes: string | null
          player_id: string | null
          reference: string
          reminder_sent_at: string | null
          series_id: string | null
          group_id: string | null
          starts_at: string
          status: string
          stripe_payment_intent_id: string | null
          total_price: number
          updated_at: string | null
          walk_in_name: string | null
        }
        Insert: {
          payment_status?: string
          pay_by?: string | null
          paid_at?: string | null
          amount_paid?: number | null
          refunded_at?: string | null
          stripe_checkout_session_id?: string | null
          stripe_account_id?: string | null
          checked_in_at?: string | null
          coach_id?: string | null
          court_id?: string | null
          created_at?: string | null
          duration_min?: number
          ends_at: string
          id?: string
          locale?: string | null
          member_id?: string | null
          notes?: string | null
          player_id?: string | null
          reference?: string
          reminder_sent_at?: string | null
          series_id?: string | null
          group_id?: string | null
          starts_at: string
          status?: string
          stripe_payment_intent_id?: string | null
          total_price: number
          updated_at?: string | null
          walk_in_name?: string | null
        }
        Update: {
          payment_status?: string
          pay_by?: string | null
          paid_at?: string | null
          amount_paid?: number | null
          refunded_at?: string | null
          stripe_checkout_session_id?: string | null
          stripe_account_id?: string | null
          checked_in_at?: string | null
          coach_id?: string | null
          court_id?: string | null
          created_at?: string | null
          duration_min?: number
          ends_at?: string
          id?: string
          locale?: string | null
          member_id?: string | null
          notes?: string | null
          player_id?: string | null
          reference?: string
          reminder_sent_at?: string | null
          series_id?: string | null
          group_id?: string | null
          starts_at?: string
          status?: string
          stripe_payment_intent_id?: string | null
          total_price?: number
          updated_at?: string | null
          walk_in_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_payments: {
        Row: {
          polar_order_id: string | null
          id: string
          club_id: string
          plan: string
          period: string
          amount: number
          method: string
          paid_until: string
          created_at: string
        }
        Insert: {
          polar_order_id?: string | null
          id?: string
          club_id: string
          plan: string
          period: string
          amount: number
          method: string
          paid_until: string
          created_at?: string
        }
        Update: {
          polar_order_id?: string | null
          id?: string
          club_id?: string
          plan?: string
          period?: string
          amount?: number
          method?: string
          paid_until?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_payments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_notices: {
        Row: {
          club_id: string
          kind: string
          sent_at: string
        }
        Insert: {
          club_id: string
          kind: string
          sent_at?: string
        }
        Update: {
          club_id?: string
          kind?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_notices_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_staff: {
        Row: {
          id: string
          club_id: string
          email: string
          user_id: string | null
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          club_id: string
          email: string
          user_id?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          club_id?: string
          email?: string
          user_id?: string | null
          created_at?: string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_staff_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          club_id: string | null
          kind: string
          data: Json
          link: string | null
          dedupe_key: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          club_id?: string | null
          kind: string
          data?: Json
          link?: string | null
          dedupe_key?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          read_at?: string | null
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          user_id: string
          muted: string[]
          updated_at: string
        }
        Insert: {
          user_id: string
          muted?: string[]
          updated_at?: string
        }
        Update: {
          user_id?: string
          muted?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      club_weekly_reports: {
        Row: {
          club_id: string
          sent_at: string
          week_start: string
        }
        Insert: {
          club_id: string
          sent_at?: string
          week_start: string
        }
        Update: {
          club_id?: string
          sent_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_weekly_reports_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          polar_subscription_id: string | null
          subscription_status: string | null
          subscription_period: string | null
          subscription_ends: boolean
          payment_mode: string
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          address: string | null
          booking_rules: Json | null
          open_matches: Json | null
          city: string | null
          country: string | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          is_active: boolean | null
          lat: number | null
          lng: number | null
          logo_url: string | null
          name: string
          opening_hours: Json | null
          owner_id: string | null
          paid_until: string | null
          plan: string
          phone: string | null
          slug: string
          trial_ends_at: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          polar_subscription_id?: string | null
          subscription_status?: string | null
          subscription_period?: string | null
          subscription_ends?: boolean
          payment_mode?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          address?: string | null
          booking_rules?: Json | null
          open_matches?: Json | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name: string
          opening_hours?: Json | null
          owner_id?: string | null
          paid_until?: string | null
          plan?: string
          phone?: string | null
          slug: string
          trial_ends_at?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          polar_subscription_id?: string | null
          subscription_status?: string | null
          subscription_period?: string | null
          subscription_ends?: boolean
          payment_mode?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          address?: string | null
          booking_rules?: Json | null
          open_matches?: Json | null
          city?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          name?: string
          opening_hours?: Json | null
          owner_id?: string | null
          paid_until?: string | null
          plan?: string
          phone?: string | null
          slug?: string
          trial_ends_at?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          bio: string | null
          club_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          levels: string[] | null
          price_per_hour: number
          profile_id: string
          specializations: string[] | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          club_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          levels?: string[] | null
          price_per_hour: number
          profile_id: string
          specializations?: string[] | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          club_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          levels?: string[] | null
          price_per_hour?: number
          profile_id?: string
          specializations?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courts: {
        Row: {
          club_id: string
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_indoor: boolean | null
          name: string
          price_per_hour: number
          sport: string
          surface: string
          updated_at: string | null
        }
        Insert: {
          club_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_indoor?: boolean | null
          name: string
          price_per_hour: number
          sport?: string
          surface: string
          updated_at?: string | null
        }
        Update: {
          club_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_indoor?: boolean | null
          name?: string
          price_per_hour?: number
          sport?: string
          surface?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          club_id: string
          created_at: string | null
          email: string | null
          ends_at: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          plan_id: string | null
          renewal_reminder_sent_at: string | null
          starts_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          club_id: string
          created_at?: string | null
          email?: string | null
          ends_at?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          renewal_reminder_sent_at?: string | null
          starts_at?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string | null
          email?: string | null
          ends_at?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          plan_id?: string | null
          renewal_reminder_sent_at?: string | null
          starts_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          billing_period: string
          club_id: string
          created_at: string | null
          description: string | null
          discount_pct: number | null
          id: string
          name: string
          price: number
        }
        Insert: {
          billing_period: string
          club_id: string
          created_at?: string | null
          description?: string | null
          discount_pct?: number | null
          id?: string
          name: string
          price: number
        }
        Update: {
          billing_period?: string
          club_id?: string
          created_at?: string | null
          description?: string | null
          discount_pct?: number | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      groups: {
        Row: {
          adults: boolean
          age_max: number | null
          age_min: number | null
          archived_at: string | null
          breaks: Json
          club_id: string
          coach_approves: boolean
          coach_id: string | null
          court_id: string | null
          created_at: string
          days: number[]
          description: string | null
          end_time: string
          ends_on: string
          id: string
          kind: string
          level: string
          max_players: number
          member_plan_id: string | null
          member_price: number | null
          name: string
          online_signup: boolean
          price: number
          sport: string
          start_time: string
          starts_on: string
          trial: boolean
        }
        Insert: {
          adults?: boolean
          age_max?: number | null
          age_min?: number | null
          archived_at?: string | null
          breaks?: Json
          club_id: string
          coach_approves?: boolean
          coach_id?: string | null
          court_id?: string | null
          created_at?: string
          days: number[]
          description?: string | null
          end_time: string
          ends_on: string
          id?: string
          kind?: string
          level?: string
          max_players?: number
          member_plan_id?: string | null
          member_price?: number | null
          name: string
          online_signup?: boolean
          price?: number
          sport?: string
          start_time: string
          starts_on: string
          trial?: boolean
        }
        Update: {
          adults?: boolean
          age_max?: number | null
          age_min?: number | null
          archived_at?: string | null
          breaks?: Json
          club_id?: string
          coach_approves?: boolean
          coach_id?: string | null
          court_id?: string | null
          created_at?: string
          days?: number[]
          description?: string | null
          end_time?: string
          ends_on?: string
          id?: string
          kind?: string
          level?: string
          max_players?: number
          member_plan_id?: string | null
          member_price?: number | null
          name?: string
          online_signup?: boolean
          price?: number
          sport?: string
          start_time?: string
          starts_on?: string
          trial?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "groups_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
        ]
      }
      group_sessions: {
        Row: {
          booking_id: string | null
          cancel_reason: string | null
          court_id: string | null
          created_at: string
          ends_at: string
          group_id: string
          id: string
          moved: boolean
          note: string | null
          register_taken_at: string | null
          schedule_cancelled: boolean
          starts_at: string
          status: string
        }
        Insert: {
          booking_id?: string | null
          cancel_reason?: string | null
          court_id?: string | null
          created_at?: string
          ends_at: string
          group_id: string
          id?: string
          moved?: boolean
          note?: string | null
          register_taken_at?: string | null
          schedule_cancelled?: boolean
          starts_at: string
          status?: string
        }
        Update: {
          booking_id?: string | null
          cancel_reason?: string | null
          court_id?: string | null
          created_at?: string
          ends_at?: string
          group_id?: string
          id?: string
          moved?: boolean
          note?: string | null
          register_taken_at?: string | null
          schedule_cancelled?: boolean
          starts_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_court_id_fkey"
            columns: ["court_id"]
            isOneToOne: false
            referencedRelation: "courts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      group_players: {
        Row: {
          age: number | null
          contact_name: string | null
          created_at: string
          email: string | null
          fee_reminded_month: string | null
          group_id: string
          id: string
          joined_on: string
          left_on: string | null
          monthly_price: number | null
          name: string
          notes: string | null
          offer_expires_at: string | null
          offer_token: string | null
          phone: string | null
          profile_id: string | null
          source: string
          status: string
          trial_session_id: string | null
          waiting_since: string | null
        }
        Insert: {
          age?: number | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          fee_reminded_month?: string | null
          group_id: string
          id?: string
          joined_on?: string
          left_on?: string | null
          monthly_price?: number | null
          name: string
          notes?: string | null
          offer_expires_at?: string | null
          offer_token?: string | null
          phone?: string | null
          profile_id?: string | null
          source?: string
          status?: string
          trial_session_id?: string | null
          waiting_since?: string | null
        }
        Update: {
          age?: number | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          fee_reminded_month?: string | null
          group_id?: string
          id?: string
          joined_on?: string
          left_on?: string | null
          monthly_price?: number | null
          name?: string
          notes?: string | null
          offer_expires_at?: string | null
          offer_token?: string | null
          phone?: string | null
          profile_id?: string | null
          source?: string
          status?: string
          trial_session_id?: string | null
          waiting_since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_players_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_attendance: {
        Row: {
          guest_name: string | null
          id: string
          paid: boolean
          player_id: string | null
          profile_id: string | null
          reason: string | null
          session_id: string
          status: string
          updated_at: string
        }
        Insert: {
          guest_name?: string | null
          id?: string
          paid?: boolean
          player_id?: string | null
          profile_id?: string | null
          reason?: string | null
          session_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          guest_name?: string | null
          id?: string
          paid?: boolean
          player_id?: string | null
          profile_id?: string | null
          reason?: string | null
          session_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "group_players"
            referencedColumns: ["id"]
          },
        ]
      }
      group_fees: {
        Row: {
          amount: number
          id: string
          marked_by: string | null
          method: string
          month: string
          paid_at: string
          player_id: string
        }
        Insert: {
          amount: number
          id?: string
          marked_by?: string | null
          method?: string
          month: string
          paid_at?: string
          player_id: string
        }
        Update: {
          amount?: number
          id?: string
          marked_by?: string | null
          method?: string
          month?: string
          paid_at?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_fees_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "group_players"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          team_size: number
          id: string
          club_id: string
          name: string
          sport: string
          starts_on: string
          description: string | null
          cover_url: string | null
          max_entries: number
          entry_fee: number | null
          status: string
          created_at: string
        }
        Insert: {
          team_size?: number
          id?: string
          club_id: string
          name: string
          sport?: string
          starts_on: string
          description?: string | null
          cover_url?: string | null
          max_entries?: number
          entry_fee?: number | null
          status?: string
          created_at?: string
        }
        Update: {
          team_size?: number
          id?: string
          club_id?: string
          name?: string
          sport?: string
          starts_on?: string
          description?: string | null
          cover_url?: string | null
          max_entries?: number
          entry_fee?: number | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_entries: {
        Row: {
          partner_name: string | null
          id: string
          tournament_id: string
          name: string
          player_id: string | null
          created_at: string
        }
        Insert: {
          partner_name?: string | null
          id?: string
          tournament_id: string
          name: string
          player_id?: string | null
          created_at?: string
        }
        Update: {
          partner_name?: string | null
          id?: string
          tournament_id?: string
          name?: string
          player_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_entries_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          id: string
          tournament_id: string
          round: number
          position: number
          entry1_id: string | null
          entry2_id: string | null
          winner_id: string | null
          score: string | null
        }
        Insert: {
          id?: string
          tournament_id: string
          round: number
          position: number
          entry1_id?: string | null
          entry2_id?: string | null
          winner_id?: string | null
          score?: string | null
        }
        Update: {
          id?: string
          tournament_id?: string
          round?: number
          position?: number
          entry1_id?: string | null
          entry2_id?: string | null
          winner_id?: string | null
          score?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_levels: {
        Row: {
          profile_id: string
          sport: string
          level: number
          rating: number | null
          rated_matches: number
          confirmed_by_club: string | null
          confirmed_at: string | null
          check_club: string | null
          check_requested_at: string | null
          updated_at: string
        }
        Insert: {
          profile_id: string
          sport: string
          level: number
          rating?: number | null
          rated_matches?: number
          confirmed_by_club?: string | null
          confirmed_at?: string | null
          check_club?: string | null
          check_requested_at?: string | null
          updated_at?: string
        }
        Update: {
          profile_id?: string
          sport?: string
          level?: number
          rating?: number | null
          rated_matches?: number
          confirmed_by_club?: string | null
          confirmed_at?: string | null
          check_club?: string | null
          check_requested_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      level_changes: {
        Row: {
          id: string
          profile_id: string
          sport: string
          source: string
          source_id: string
          parent_id: string | null
          delta: number
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          sport: string
          source: string
          source_id: string
          delta: number
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          sport?: string
          source?: string
          source_id?: string
          parent_id?: string | null
          delta?: number
          created_at?: string
        }
        Relationships: []
      }
      court_closures: {
        Row: {
          id: string
          club_id: string
          court_ids: string[] | null
          starts_at: string
          ends_at: string
          reason: string
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          court_ids?: string[] | null
          starts_at: string
          ends_at: string
          reason?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          court_ids?: string[] | null
          starts_at?: string
          ends_at?: string
          reason?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      leagues: {
        Row: {
          id: string
          club_id: string
          name: string
          sport: string
          team_size: number
          box_size: number
          round_weeks: number
          move_count: number
          starts_on: string
          max_entries: number
          entry_fee: number | null
          level_min: number | null
          level_max: number | null
          description: string | null
          cover_url: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          name: string
          sport?: string
          team_size?: number
          box_size?: number
          round_weeks?: number
          move_count?: number
          starts_on: string
          max_entries?: number
          entry_fee?: number | null
          level_min?: number | null
          level_max?: number | null
          description?: string | null
          cover_url?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          name?: string
          sport?: string
          team_size?: number
          box_size?: number
          round_weeks?: number
          move_count?: number
          starts_on?: string
          max_entries?: number
          entry_fee?: number | null
          level_min?: number | null
          level_max?: number | null
          description?: string | null
          cover_url?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      league_entries: {
        Row: {
          id: string
          league_id: string
          name: string
          partner_name: string | null
          player_id: string | null
          level: number | null
          seed: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          league_id: string
          name: string
          partner_name?: string | null
          player_id?: string | null
          level?: number | null
          seed?: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          name?: string
          partner_name?: string | null
          player_id?: string | null
          level?: number | null
          seed?: number
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_entries_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      social_events: {
        Row: {
          id: string
          club_id: string
          name: string
          sport: string
          format: string
          starts_at: string
          ends_at: string
          court_ids: string[]
          points_per_match: number
          max_players: number
          entry_fee: number | null
          level_min: number | null
          level_max: number | null
          description: string | null
          cover_url: string | null
          status: string
          booking_ids: string[]
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          name: string
          sport?: string
          format?: string
          starts_at: string
          ends_at: string
          court_ids?: string[]
          points_per_match?: number
          max_players?: number
          entry_fee?: number | null
          level_min?: number | null
          level_max?: number | null
          description?: string | null
          cover_url?: string | null
          status?: string
          booking_ids?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          name?: string
          sport?: string
          format?: string
          starts_at?: string
          ends_at?: string
          court_ids?: string[]
          points_per_match?: number
          max_players?: number
          entry_fee?: number | null
          level_min?: number | null
          level_max?: number | null
          description?: string | null
          cover_url?: string | null
          status?: string
          booking_ids?: string[]
          created_at?: string
        }
        Relationships: []
      }
      social_players: {
        Row: {
          id: string
          event_id: string
          name: string
          player_id: string | null
          level: number | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          name: string
          player_id?: string | null
          level?: number | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          name?: string
          player_id?: string | null
          level?: number | null
          status?: string
          created_at?: string
        }
        Relationships: []
      }
      social_matches: {
        Row: {
          id: string
          event_id: string
          round: number
          court_index: number
          a1: string
          a2: string
          b1: string
          b2: string
          score_a: number | null
          score_b: number | null
          reported_by: string | null
          reported_at: string | null
        }
        Insert: {
          id?: string
          event_id: string
          round: number
          court_index: number
          a1: string
          a2: string
          b1: string
          b2: string
          score_a?: number | null
          score_b?: number | null
          reported_by?: string | null
          reported_at?: string | null
        }
        Update: {
          id?: string
          event_id?: string
          round?: number
          court_index?: number
          a1?: string
          a2?: string
          b1?: string
          b2?: string
          score_a?: number | null
          score_b?: number | null
          reported_by?: string | null
          reported_at?: string | null
        }
        Relationships: []
      }
      social_byes: {
        Row: {
          event_id: string
          round: number
          player: string
        }
        Insert: {
          event_id: string
          round: number
          player: string
        }
        Update: {
          event_id?: string
          round?: number
          player?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_my_level: { Args: { p_sport: string; p_level: number }; Returns: undefined }
      request_level_check: { Args: { p_sport: string; p_club: string }; Returns: undefined }
      confirm_player_level: {
        Args: { p_profile: string; p_sport: string; p_level: number }
        Returns: undefined
      }
      dismiss_level_check: { Args: { p_profile: string; p_sport: string }; Returns: undefined }
      create_open_match: {
        Args: {
          p_booking: string
          p_level_min: number
          p_level_max: number
          p_competitive: boolean
          p_max_players: number
          p_note?: string | null
        }
        Returns: string
      }
      join_open_match: { Args: { p_match: string; p_team?: number | null }; Returns: string }
      answer_match_request: {
        Args: { p_match: string; p_profile: string; p_accept: boolean }
        Returns: undefined
      }
      leave_open_match: { Args: { p_match: string }; Returns: undefined }
      remove_match_player: { Args: { p_match: string; p_profile: string }; Returns: undefined }
      keep_match_court: { Args: { p_match: string; p_keep: boolean }; Returns: undefined }
      post_match_message: { Args: { p_match: string; p_body: string }; Returns: undefined }
      open_match_feed: { Args: { p_club?: string | null; p_sport?: string | null }; Returns: Json }
      open_match_detail: { Args: { p_match: string }; Returns: Json }
      open_match_clubs: { Args: never; Returns: Json }
      club_open_matches: { Args: { p_club: string }; Returns: Json }
      run_open_match_jobs: { Args: never; Returns: Json }
      claim_club_admin_role: { Args: never; Returns: undefined }
      run_scheduled_notifications: { Args: never; Returns: Json }
      preview_group_sessions: {
        Args: {
          p_club: string
          p_court: string | null
          p_coach: string | null
          p_days: number[]
          p_start_time: string
          p_end_time: string
          p_starts_on: string
          p_ends_on: string
          p_breaks: Json
          p_group?: string | null
        }
        Returns: {
          day: string
          starts_at: string
          ends_at: string
          existing: boolean
          clash: string | null
          clash_who: string | null
          clash_starts: string | null
          clash_ends: string | null
          free_court_id: string | null
          free_court_name: string | null
        }[]
      }
      sync_group_sessions: { Args: { p_group: string; p_choices?: Json }; Returns: Json }
      cancel_group_session: {
        Args: { p_session: string; p_reason?: string | null }
        Returns: { name: string; contact_name: string | null; email: string | null }[]
      }
      restore_group_session: { Args: { p_session: string }; Returns: undefined }
      move_group_session: {
        Args: { p_session: string; p_starts_at: string; p_ends_at: string; p_court: string }
        Returns: undefined
      }
      save_group_register: {
        Args: { p_session: string; p_rows: Json; p_note?: string | null }
        Returns: undefined
      }
      set_group_absence: {
        Args: { p_session: string; p_player: string; p_absent: boolean; p_reason?: string | null }
        Returns: undefined
      }
      join_group: {
        Args: {
          p_group: string
          p_name: string
          p_age?: number | null
          p_phone?: string | null
          p_for_self?: boolean
          p_trial?: boolean
        }
        Returns: Json
      }
      leave_group: { Args: { p_player: string }; Returns: undefined }
      offer_group_places: {
        Args: { p_group: string; p_player?: string | null }
        Returns: {
          player_id: string
          name: string
          contact_name: string | null
          email: string | null
          token: string
          expires_at: string
        }[]
      }
      group_offer_info: { Args: { p_token: string }; Returns: Json }
      respond_group_offer: { Args: { p_token: string; p_accept: boolean }; Returns: string }
      expire_group_offers: { Args: never; Returns: string[] }
      book_group_session: { Args: { p_session: string; p_name?: string | null }; Returns: undefined }
      unbook_group_session: { Args: { p_session: string }; Returns: undefined }
      paused_clubs: { Args: { p_clubs: string[] }; Returns: string[] }
      public_groups: {
        Args: { p_club: string }
        Returns: {
          id: string
          name: string
          kind: string
          sport: string
          level: string
          age_min: number | null
          age_max: number | null
          adults: boolean
          days: number[]
          start_time: string
          end_time: string
          starts_on: string
          ends_on: string
          price: number
          max_players: number
          trial: boolean
          coach_approves: boolean
          description: string | null
          coach_name: string | null
          court_name: string | null
          taken: number
          waiting: number
          sessions: Json
        }[]
      }
      due_group_fee_reminders: {
        Args: never
        Returns: {
          player_id: string
          name: string
          contact_name: string | null
          email: string | null
          group_name: string
          club_id: string
          club_name: string
          amount: number
          month: string
        }[]
      }
      club_locked: { Args: { p_club: string }; Returns: boolean }
      club_max_courts: { Args: { p_club_id: string }; Returns: number | null }
      find_profile_by_email: {
        Args: { lookup_email: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      my_memberships: { Args: never; Returns: Json }
      complete_finished_bookings: { Args: never; Returns: number }
      expire_memberships: { Args: never; Returns: number }
      my_member_ids: { Args: never; Returns: string[] }
      get_coach_busy_slots: {
        Args: { p_coach_id: string; p_day: string }
        Returns: {
          ends_at: string
          starts_at: string
        }[]
      }
      get_busy_slots: {
        Args: { p_court_id: string; p_day: string }
        Returns: {
          ends_at: string
          starts_at: string
          closed: boolean
        }[]
      }
      close_courts: {
        Args: {
          p_club: string
          p_courts: string[] | null
          p_starts: string
          p_ends: string
          p_reason: string
          p_note?: string | null
          p_reason_text?: string | null
        }
        Returns: Json
      }
      reopen_courts: { Args: { p_closure: string }; Returns: undefined }
      upcoming_club_closures: {
        Args: { p_club: string }
        Returns: { starts_at: string; ends_at: string; reason: string; courts: string[] | null }[]
      }
      league_view: { Args: { p_league: string }; Returns: Json }
      social_view: { Args: { p_event: string }; Returns: Json }
      social_sign_up: { Args: { p_event: string; p_name: string }; Returns: string }
      social_withdraw: { Args: { p_event: string }; Returns: undefined }
      social_save_score: { Args: { p_match: string; p_score_a: number | null }; Returns: undefined }
      club_payment_mode: { Args: { p_club: string }; Returns: string }
      confirm_online_payment: {
        Args: { p_booking: string; p_session: string; p_payment_intent: string; p_amount: number; p_account: string }
        Returns: string
      }
      expire_unpaid_bookings: {
        Args: never
        Returns: { id: string; stripe_checkout_session_id: string | null; club_account: string | null }[]
      }
      my_leagues: { Args: never; Returns: Json }
      league_sign_up: { Args: { p_league: string; p_name: string; p_partner: string }; Returns: string }
      league_withdraw: { Args: { p_league: string }; Returns: undefined }
      league_next_round: { Args: { p_league: string }; Returns: string }
      league_undo_round: { Args: { p_league: string }; Returns: undefined }
      league_finish: { Args: { p_league: string }; Returns: undefined }
      league_save_score: { Args: { p_match: string; p_sets: Json | null; p_walkover: string | null }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
