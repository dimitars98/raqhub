"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyNewClub } from "@/lib/automation/jobs";

/**
 * Called right after a club owner creates their club: emails you
 * (ADMIN_EMAIL) about it. The email goes out after the response, so signing
 * up is not slowed down. Never sent twice; the hourly run catches any miss.
 */
export async function announceNewClub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: club } = await supabase
    .from("clubs")
    .select("id, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Only for a club created in the last hour.
  if (!club?.created_at || Date.now() - new Date(club.created_at).getTime() > 3_600_000) return;

  after(async () => {
    try {
      await notifyNewClub(createAdminClient(), club.id);
    } catch (e) {
      console.error("[new club email]", e);
    }
  });
}
