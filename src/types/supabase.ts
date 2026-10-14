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
          starts_at: string
          status: string
          stripe_payment_intent_id: string | null
          total_price: number
          updated_at: string | null
          walk_in_name: string | null
        }
        Insert: {
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
          starts_at: string
          status?: string
          stripe_payment_intent_id?: string | null
          total_price: number
          updated_at?: string | null
          walk_in_name?: string | null
        }
        Update: {
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
          address: string | null
          booking_rules: Json | null
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
          address?: string | null
          booking_rules?: Json | null
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
          address?: string | null
          booking_rules?: Json | null
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
          created_at: string | null
          description: string | null
          id: string
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
          created_at?: string | null
          description?: string | null
          id?: string
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
          created_at?: string | null
          description?: string | null
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_club_admin_role: { Args: never; Returns: undefined }
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
        }[]
      }
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
