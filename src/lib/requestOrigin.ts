import { headers } from "next/headers";
import { appUrl } from "@/lib/email/bookings";

/**
 * The address the admin has the app open at (https://kortello.com, or
 * http://localhost:3000 while developing), for links they copy and share.
 * Falls back to NEXT_PUBLIC_APP_URL when there's no request to go by.
 */
export async function requestOrigin() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0].trim();
  if (!host) return appUrl();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}
