"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BILLING_COLUMNS, clubAccess } from "@/lib/plans";
import { sendEmail } from "@/lib/email/send";
import { staffInviteEmail } from "@/lib/email/templates";
import { appUrl } from "@/lib/email/bookings";
import { pickLocale } from "@/lib/email/locale";

// The owner's staff list (supabase/migrations/20261020_staff.sql). Every
// write goes through the owner's own session, so the database makes sure an
// owner only ever changes their own club's list.

type Result = { error?: string; emailSent?: boolean };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function inviteStaff(rawEmail: string): Promise<Result> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return { error: "email" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "failed" };
  if (email === user.email?.toLowerCase()) return { error: "self" };

  const [{ data: club }, { data: profile }] = await Promise.all([
    supabase
      .from("clubs")
      .select(`id, name, ${BILLING_COLUMNS}`)
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!club) return { error: "failed" };
  if (!clubAccess(club).has("staff")) return { error: "plan" };

  const { error } = await supabase
    .from("club_staff")
    .insert({ club_id: club.id, email });
  if (error?.code === "23505") return { error: "already" };
  if (error?.message?.includes("at most 20")) return { error: "limit" };
  if (error) {
    console.error("[staff] invite", error);
    return { error: "failed" };
  }

  // The invite is saved either way; the email is a convenience.
  const emailSent = await sendEmail({
    to: email,
    replyTo: user.email,
    ...staffInviteEmail({
      locale: pickLocale(await getLocale()),
      clubName: club.name,
      ownerName: profile?.full_name ?? null,
      email,
      appUrl: appUrl(),
    }),
  });

  revalidatePath("/[locale]/admin/staff", "page");
  return { emailSent };
}

export async function removeStaff(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("club_staff").delete().eq("id", id);
  if (error) return { error: "failed" };
  revalidatePath("/[locale]/admin/staff", "page");
  return {};
}
