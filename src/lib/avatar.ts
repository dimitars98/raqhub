// Initials and a stable colour for people without a profile photo.

/** "Ana Petrovska" -> "AP". */
export function initials(name: string | null | undefined, fallback = "?") {
  const letters = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || fallback;
}

// Only colours that exist in the theme.
const AVATAR_COLORS = [
  "bg-brand-100 text-brand-900",
  "bg-court-100 text-court-800",
  "bg-accent-100 text-accent-800",
  "bg-ink-100 text-ink-800",
];

/** The same id always gets the same colour, whatever the order on screen. */
export function avatarColor(id: string) {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
