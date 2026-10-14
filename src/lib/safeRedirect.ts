/**
 * A "?redirectTo=" / "?next=" value we are willing to follow: a path inside
 * this site only. Anything else (other sites, "//evil.com", backslashes)
 * gives null, so nobody can use our login link to send people elsewhere.
 */
export function getSafeRedirect(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  return value;
}
