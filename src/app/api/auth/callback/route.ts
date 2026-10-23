import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Profile } from "@/types/database";
import { getSafeRedirect } from "@/lib/safeRedirect";
import { routing } from "@/i18n/routing";
import { homeFor } from "@/lib/roles";

const LOCALES: readonly string[] = routing.locales;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirect(searchParams.get("next"));
  const wantsClubAccount = searchParams.get("role") === "admin";

  const localeParam = searchParams.get("locale");
  const prefix =
    localeParam && LOCALES.includes(localeParam) ? `/${localeParam}` : "";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[auth callback] code exchange", error.message);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Only has an effect on accounts created in the last few minutes
        if (wantsClubAccount) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: claimError } = await (supabase as any).rpc("claim_club_admin_role");
          // They can still sign in; the log shows why they ended up as a player.
          if (claimError) console.error("[auth callback] claim_club_admin_role", claimError);
        }

        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const role = (data as Pick<Profile, "role"> | null)?.role;

        if (next) return NextResponse.redirect(`${origin}${next}`);
        return NextResponse.redirect(`${origin}${prefix}${homeFor(role)}`);
      }
    }
  }

  return NextResponse.redirect(
    `${origin}${prefix}/login?error=auth_callback_failed`,
  );
}
