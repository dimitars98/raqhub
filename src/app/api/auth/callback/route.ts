import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Profile } from "@/types/database";

const LOCALES = ["en", "de", "mk"];

// Only allow redirects to paths inside this site
function getSafeRedirect(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  return value;
}

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

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Only has an effect on accounts created in the last few minutes
        if (wantsClubAccount) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).rpc("claim_club_admin_role");
        }

        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const role = (data as Pick<Profile, "role"> | null)?.role;

        if (next) return NextResponse.redirect(`${origin}${next}`);
        if (role === "club_admin" || role === "super_admin") {
          return NextResponse.redirect(`${origin}${prefix}/admin/dashboard`);
        }
        return NextResponse.redirect(`${origin}${prefix}/book`);
      }
    }
  }

  return NextResponse.redirect(
    `${origin}${prefix}/login?error=auth_callback_failed`,
  );
}
