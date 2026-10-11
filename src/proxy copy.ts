import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const ADMIN_ROUTES = ["/admin"];
const MEMBER_ROUTES = ["/book", "/my-bookings", "/membership"];
const AUTH_ROUTES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Strip locale prefix to check route type
  const pathnameWithoutLocale = pathname.replace(/^\/(mk|en|sq)/, "") || "/";

  const isAdminRoute = ADMIN_ROUTES.some((r) =>
    pathnameWithoutLocale.startsWith(r),
  );
  const isMemberRoute = MEMBER_ROUTES.some((r) =>
    pathnameWithoutLocale.startsWith(r),
  );
  const isAuthRoute = AUTH_ROUTES.some((r) =>
    pathnameWithoutLocale.startsWith(r),
  );

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Detect locale from URL
  const localeMatch = pathname.match(/^\/(mk|en|sq)/);
  const locale = localeMatch ? localeMatch[1] : "mk";

  if (!user && (isAdminRoute || isMemberRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("redirectTo", pathnameWithoutLocale);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role: string } | null)?.role;
    const url = request.nextUrl.clone();
    url.pathname =
      role === "club_admin" || role === "super_admin"
        ? `/${locale}/admin/members`
        : `/${locale}/book`;
    return NextResponse.redirect(url);
  }

  if (user && isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role: string } | null)?.role;
    if (role !== "club_admin" && role !== "super_admin") {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/book`;
      return NextResponse.redirect(url);
    }
  }

  // Run intl middleware for locale detection and redirects
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
