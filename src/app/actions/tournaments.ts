"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Player side of tournaments: sign up and withdraw. The database checks that
// sign-ups are open and there is a place left (20261018_tournaments.sql).

type Result = { error?: "notSignedIn" | "closed" | "full" | "already" | "name" | "failed" };

export async function signUpForTournament(tournamentId: string, name: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notSignedIn" };

  const clean = name.trim().slice(0, 120);
  if (!clean) return { error: "name" };

  const { error } = await supabase
    .from("tournament_entries")
    .insert({ tournament_id: tournamentId, name: clean, player_id: user.id });

  if (error) {
    if (error.code === "23505") return { error: "already" };
    if (error.message?.includes("full")) return { error: "full" };
    if (error.message?.includes("closed")) return { error: "closed" };
    console.error("[tournaments] sign up", error);
    return { error: "failed" };
  }
  revalidatePath("/[locale]/tournaments/[id]", "page");
  return {};
}

export async function withdrawFromTournament(tournamentId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "notSignedIn" };

  const { error } = await supabase
    .from("tournament_entries")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("player_id", user.id);
  if (error) return { error: "failed" };
  revalidatePath("/[locale]/tournaments/[id]", "page");
  return {};
}
