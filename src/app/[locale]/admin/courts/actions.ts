"use server";

import { createClient } from "@/lib/supabase/server";
import type { Court, Sport, Surface } from "@/types/database";
import { MAX_COURTS_AT_ONCE } from "@/lib/plans";
import { isCourtColor } from "@/lib/courtColors";

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
  /** The court's real colour (src/lib/courtColors.ts). */
  color: string | null;
};

// reason "limit": the club's plan doesn't allow another active court.
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason?: "limit" };

/** A court photo, after the browser has shrunk it (src/lib/resizeImage.ts). */
const MAX_IMAGE_BYTES = 1024 * 1024;

export type ImageResult =
  | { ok: true; url: string | null }
  | { ok: false; reason?: "notImage" | "tooBig" };

/** The database refuses a court over the plan's limit (see migrations). */
const isCourtLimit = (error: { message?: string } | null) =>
  !!error?.message?.includes("court limit");

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
    color: isCourtColor(input.color) ? input.color : null,
  };
}

/**
 * Adds one court, or several identical ones named "<name> 1", "<name> 2", ...
 * All or nothing: if the plan's court limit would be passed, none are added.
 */
export async function createCourts(
  input: CourtInput,
  count: number,
): Promise<ActionResult<Court[]>> {
  const supabase = await createClient();
  const clubId = await getOwnedClubId(supabase);
  const fields = cleanInput(input);
  const n = Math.floor(Number(count));
  if (!clubId || !fields || !(n >= 1 && n <= MAX_COURTS_AT_ONCE)) return { ok: false };

  const rows = Array.from({ length: n }, (_, i) => ({
    ...fields,
    name: n === 1 ? fields.name : `${fields.name} ${i + 1}`,
    club_id: clubId,
  }));

  const { data, error } = await supabase.from("courts").insert(rows).select();

  if (error || !data) {
    if (isCourtLimit(error)) return { ok: false, reason: "limit" };
    console.error("createCourts failed:", error);
    return { ok: false };
  }
  return { ok: true, data: data as unknown as Court[] };
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
    if (isCourtLimit(error)) return { ok: false, reason: "limit" };
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
    if (isCourtLimit(error)) return { ok: false, reason: "limit" };
    console.error("toggleCourt failed:", error);
    return { ok: false };
  }
  return { ok: true, data: null };
}

/**
 * Sets the photo of one court, or of several added together (they share it).
 * Stored in the uploader's own folder of the public avatars bucket.
 */
export async function uploadCourtImage(formData: FormData): Promise<ImageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const clubId = await getOwnedClubId(supabase);
  const ids = String(formData.get("courtIds") ?? "")
    .split(",")
    .filter(Boolean);
  const file = formData.get("image");
  if (!user || !clubId || !ids.length || ids.length > MAX_COURTS_AT_ONCE) return { ok: false };
  if (!(file instanceof Blob) || file.size === 0) return { ok: false };
  if (!file.type.startsWith("image/")) return { ok: false, reason: "notImage" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "tooBig" };

  // A new name each time, so browsers don't keep showing the old photo.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/court-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("uploadCourtImage failed:", uploadError);
    return { ok: false };
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const { data, error } = await supabase
    .from("courts")
    .update({ image_url: pub.publicUrl })
    .in("id", ids)
    .eq("club_id", clubId)
    .select("id");
  if (error || !data?.length) {
    console.error("uploadCourtImage failed:", error);
    return { ok: false };
  }
  return { ok: true, url: pub.publicUrl };
}

/** Removes a court's photo; the court is drawn again. */
export async function removeCourtImage(id: string): Promise<ImageResult> {
  const supabase = await createClient();
  const clubId = await getOwnedClubId(supabase);
  if (!clubId) return { ok: false };

  const { data, error } = await supabase
    .from("courts")
    .update({ image_url: null })
    .eq("id", id)
    .eq("club_id", clubId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("removeCourtImage failed:", error);
    return { ok: false };
  }
  return { ok: true, url: null };
}
