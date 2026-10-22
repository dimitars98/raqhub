import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { FormCoach, FormCourt, FormPlan } from "@/components/groups/GroupForm";
import type { Sport } from "@/types/database";

// What the new/edit group form needs: the club's courts, coaches and plans.
export async function groupFormOptions(supabase: SupabaseClient<Database>, clubId: string) {
  const [{ data: courts }, { data: coaches }, { data: plans }] = await Promise.all([
    supabase.from("courts").select("id, name, sport").eq("club_id", clubId).eq("is_active", true).order("name"),
    supabase
      .from("coaches")
      .select("id, profile:profiles(full_name)")
      .eq("club_id", clubId)
      .eq("is_active", true),
    supabase.from("membership_plans").select("id, name").eq("club_id", clubId).order("name"),
  ]);
  return {
    courts: (courts ?? []).map((c) => ({ id: c.id, name: c.name, sport: c.sport as Sport })) as FormCourt[],
    coaches: ((coaches ?? []) as unknown as { id: string; profile: { full_name: string | null } | null }[])
      .map((c) => ({ id: c.id, name: c.profile?.full_name ?? "—" }))
      .sort((a, b) => a.name.localeCompare(b.name)) as FormCoach[],
    plans: (plans ?? []) as FormPlan[],
  };
}
