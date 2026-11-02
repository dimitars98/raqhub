"use server";

import { createClient } from "@/lib/supabase/server";

// A poster for a league, tournament or Americano evening, uploaded by the
// club. The database's own rules decide who may change an event (its club's
// owner or staff), so an update that matches no row means "not allowed".

export type EventKind = "league" | "tournament" | "americano";
export type CoverResult = { ok: true; url: string | null } | { ok: false; reason?: "notImage" | "tooBig" };

const TABLE = { league: "leagues", tournament: "tournaments", americano: "social_events" } as const;
/** After the browser has shrunk it (src/lib/resizeImage.ts). */
const MAX_BYTES = 1024 * 1024;
const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function uploadEventCover(kind: EventKind, id: string, formData: FormData): Promise<CoverResult> {
  if (!(kind in TABLE) || !isId(id)) return { ok: false };
  const file = formData.get("image");
  if (!(file instanceof Blob) || file.size === 0) return { ok: false };
  if (!file.type.startsWith("image/")) return { ok: false, reason: "notImage" };
  if (file.size > MAX_BYTES) return { ok: false, reason: "tooBig" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // A new name each time, so browsers and WhatsApp don't keep the old one.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/${kind}-${id}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("uploadEventCover failed:", uploadError);
    return { ok: false };
  }
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);

  const { data, error } = await supabase
    .from(TABLE[kind])
    .update({ cover_url: pub.publicUrl })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("uploadEventCover failed:", error);
    return { ok: false };
  }
  return { ok: true, url: pub.publicUrl };
}

export async function removeEventCover(kind: EventKind, id: string): Promise<CoverResult> {
  if (!(kind in TABLE) || !isId(id)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLE[kind])
    .update({ cover_url: null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("removeEventCover failed:", error);
    return { ok: false };
  }
  return { ok: true, url: null };
}
