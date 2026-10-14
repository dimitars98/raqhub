"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { validateHours } from "@/lib/openingHours";
import type { OpeningHours } from "@/types/database";
import { MAX_DAYS_AHEAD, normalizeRules, validateRules, type BookingRules } from "@/lib/bookingRules";

export type SaveResult = { ok: true } | { ok: false; error: string };

export type ClubInfoInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  website: string;
  description: string;
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const orNull = (v: string) => (v.trim() ? v.trim() : null);

// Adds https:// when someone types "myclub.mk"; only http(s) links are kept.
function cleanWebsite(v: string) {
  const value = v.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The signed-in user's id and the id of the club they own. */
async function ownerContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: club } = await supabase
    .from("clubs")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!club) return null;
  return { supabase, userId: user.id, clubId: club.id };
}

/** An error message in the admin's language. */
async function fail(key: string, values?: Record<string, number>): Promise<SaveResult> {
  const t = await getTranslations("settingsErrors");
  return { ok: false, error: t(key, values) };
}

function refresh() {
  revalidatePath("/[locale]/admin", "layout");
}

export async function saveClubInfo(input: ClubInfoInput): Promise<SaveResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("notAllowed");

  const name = input.name?.trim();
  if (!name) return fail("needName");
  if (input.website?.trim() && !cleanWebsite(input.website))
    return fail("badWebsite");

  const { error } = await ctx.supabase
    .from("clubs")
    .update({
      name,
      email: orNull(input.email ?? ""),
      phone: orNull(input.phone ?? ""),
      address: orNull(input.address ?? ""),
      city: orNull(input.city ?? ""),
      country: orNull(input.country ?? "") ?? "MK",
      website: cleanWebsite(input.website ?? ""),
      description: orNull(input.description ?? ""),
    })
    .eq("id", ctx.clubId);

  if (error) {
    console.error("[saveClubInfo]", error);
    return fail("saveFailed");
  }
  refresh();
  return { ok: true };
}

export async function saveOpeningHours(hours: OpeningHours): Promise<SaveResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("notAllowed");

  const problem = validateHours(hours);
  if (problem) return fail(problem);

  const clean = hours.map((d) => ({ open: !!d.open, from: d.from, to: d.to }));
  const { error } = await ctx.supabase
    .from("clubs")
    .update({ opening_hours: clean })
    .eq("id", ctx.clubId);

  if (error) {
    console.error("[saveOpeningHours]", error);
    return fail("saveFailed");
  }
  refresh();
  return { ok: true };
}

/** Booking rules players must follow (the database enforces them too). */
export async function saveBookingRules(input: BookingRules): Promise<SaveResult> {
  const ctx = await ownerContext();
  if (!ctx) return fail("notAllowed");

  const rules = normalizeRules(input);
  const problem = validateRules(rules);
  if (problem) return fail(problem, { max: MAX_DAYS_AHEAD });

  const { error } = await ctx.supabase
    .from("clubs")
    .update({ booking_rules: rules })
    .eq("id", ctx.clubId);

  if (error) {
    console.error("[saveBookingRules]", error);
    return fail("saveFailed");
  }
  refresh();
  return { ok: true };
}

/** Club logo, stored in the owner's own folder of the avatars bucket. */
export async function saveClubLogo(formData: FormData): Promise<SaveResult & { url?: string }> {
  const ctx = await ownerContext();
  if (!ctx) return fail("notAllowed");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("chooseImage");
  if (!file.type.startsWith("image/")) return fail("notImage");
  if (file.size > MAX_LOGO_BYTES) return fail("tooBig");

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  // A new name each time, so browsers don't keep showing the old logo.
  const path = `${ctx.userId}/club-logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("[saveClubLogo]", uploadError);
    return fail("uploadFailed");
  }

  const { data } = ctx.supabase.storage.from("avatars").getPublicUrl(path);
  const { error } = await ctx.supabase
    .from("clubs")
    .update({ logo_url: data.publicUrl })
    .eq("id", ctx.clubId);
  if (error) {
    console.error("[saveClubLogo]", error);
    return fail("saveFailed");
  }
  refresh();
  return { ok: true, url: data.publicUrl };
}
