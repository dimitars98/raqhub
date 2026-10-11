"use server";

import { createClient } from "@/lib/supabase/server";
import type { Court, Sport, Surface } from "@/types/database";

// club_id is deliberately not accepted from the browser. The server works out
// which club the signed-in user owns, so nobody can write to another club.
export type CourtInput = {
  name: string;
  sport: Sport;
  surface: Surface;
  is_indoor: boolean;
  price_per_hour: number;
  description: string | null;
  is_active: boolean;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The id of the club owned by the signed-in user, or null. */
async function getOwnedClubId(supabase: Supabase): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("clubs")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Keeps only the fields a court may have, cleaned up. Null if invalid. */
function cleanInput(input: CourtInput): CourtInput | null {
  const name = input.name?.trim();
  const price = Number(input.price_per_hour);
  if (!name || !Number.isFinite(price) || price < 0) return null;

  return {
    name,
    sport: input.sport,
    surface: input.surface,
    is_indoor: Boolean(input.is_indoor),
    price_per_hour: price,
    description: input.description?.trim() || null,
    is_active: Boolean(input.is_active),
  };
}

export async function createCourt(
  input: CourtInput,
): Promise<ActionResult<Court>> {
  const supabase = await createClient();
  const clubId = await getOwnedClubId(supabase);
  const fields = cleanInput(input);
  if (!clubId || !fields) return { ok: false };

  const { data, error } = await supabase
    .from("courts")
    .insert({ ...fields, club_id: clubId })
    .select()
    .single();

  if (error || !data) {
    console.error("createCourt failed:", error);
    return { ok: false };
  }
  return { ok: true, data: data as unknown as Court };
}

export async function updateCourt(
  id: string,
  input: CourtInput,
): Promise<ActionResult<Court>> {
  const supabase = await createClient();
  const clubId = await getOwnedClubId(supabase);
  const fields = cleanInput(input);
  if (!clubId || !fields) return { ok: false };

  // The club_id filter means a court in someone else's club matches nothing.
  const { data, error } = await supabase
    .from("courts")
    .update(fields)
    .eq("id", id)
    .eq("club_id", clubId)
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error("updateCourt failed:", error);
    return { ok: false };
  }
  return { ok: true, data: data as unknown as Court };
}

export async function toggleCourt(
  id: string,
  is_active: boolean,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const clubId = await getOwnedClubId(supabase);
  if (!clubId) return { ok: false };

  const { data, error } = await supabase
    .from("courts")
    .update({ is_active: Boolean(is_active) })
    .eq("id", id)
    .eq("club_id", clubId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("toggleCourt failed:", error);
    return { ok: false };
  }
  return { ok: true, data: null };
}
