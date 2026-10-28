"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { socialError, type SocialResult } from "@/lib/americanoErrors";

// Player side of Americano evenings (the club uses saveSocialScore too).
// The database checks who may do what (20261030_americano.sql).

const refresh = () => {
  revalidatePath("/[locale]/americano/[id]", "page");
  revalidatePath("/[locale]/admin/americano/[id]", "page");
};

export async function signUpForSocial(eventId: string, name: string): Promise<SocialResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("social_sign_up", { p_event: eventId, p_name: name.trim().slice(0, 120) });
  if (error) return { error: socialError(error, "[americano] sign up") };
  refresh();
  return {};
}

export async function withdrawFromSocial(eventId: string): Promise<SocialResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("social_withdraw", { p_event: eventId });
  if (error) return { error: socialError(error, "[americano] withdraw") };
  refresh();
  return {};
}

/** Side A's points; side B gets the rest. Null clears it (club only). */
export async function saveSocialScore(matchId: string, scoreA: number | null): Promise<SocialResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("social_save_score", { p_match: matchId, p_score_a: scoreA });
  if (error) return { error: socialError(error, "[americano] score") };
  refresh();
  return {};
}
