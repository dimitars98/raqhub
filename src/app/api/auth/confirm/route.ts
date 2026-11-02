import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirect } from "@/lib/safeRedirect";
import { homeFor } from "@/lib/roles";
import type { Profile } from "@/types/database";

// The links in Supabase's emails (sign-up confirmation, password reset,
// email change) point here, on raqhub.com, instead of to supabase.co:
//
//   {{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
//
// A link to our own domain looks trustworthy to Gmail, and unlike the code
// in /api/auth/callback it works on any device, not only in the browser
// where the person asked for it. Paths are given without a language: the
// language middleware adds the person's own.

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = getSafeRedirect(searchParams.get("next"));

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) console.error("[auth confirm]", type, error.message);

    if (!error) {
      if (next) return NextResponse.redirect(`${origin}${next}`);
      // Signed in for this one purpose: choose a new password.
      if (type === "recovery") return NextResponse.redirect(`${origin}/reset-password`);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data } = user
        ? await supabase.from("profiles").select("role").eq("id", user.id).single()
        : { data: null };
      const role = (data as Pick<Profile, "role"> | null)?.role;
      return NextResponse.redirect(`${origin}${homeFor(role)}`);
    }
  }

  // Expired or already used.
  if (type === "recovery") return NextResponse.redirect(`${origin}/forgot-password?expired=1`);
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
