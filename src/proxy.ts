import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

// "/de/admin" -> ["/de", "de"]; built from routing so new languages are covered.
const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

const ADMIN_ROUTES = ["/admin"];
const MEMBER_ROUTES = ["/book", "/my-bookings", "/membership"];
const AUTH_ROUTES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathnameWithoutLocale = pathname.replace(LOCALE_PREFIX, "") || "/";

  // 1. Run Intl Middleware first to get the response object
  const response = intlMiddleware(request);

  // 2. Initialize Supabase with that response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value); // Sync with request
            response.cookies.set(name, value, options); // Sync with response
          });
        },
      },
    },
  );

  // 3. ONLY check the user. Do NOT check the profile/role in the middleware.
  // Move role checks to the Layout to avoid redundant DB calls.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const localeMatch = pathname.match(LOCALE_PREFIX);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  // Redirect if not logged in
  const isProtected =
    ADMIN_ROUTES.some((r) => pathnameWithoutLocale.startsWith(r)) ||
    MEMBER_ROUTES.some((r) => pathnameWithoutLocale.startsWith(r));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // If we are logged in and going to /login, send them to a default page
  if (user && AUTH_ROUTES.some((r) => pathnameWithoutLocale.startsWith(r))) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/book`; // Simple redirect, let Layout handle specific roles
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

/*Emergency commands

# 1. Kill all "ghost" Node processes
Stop-Process -Name "node" -Force

# 2. Delete the compiled build cache (Next.js)
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue

# 3. Delete the local package cache
Remove-Item -Path "node_modules/.cache" -Recurse -Force -ErrorAction SilentlyContinue
*/
