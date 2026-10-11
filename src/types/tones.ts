export type Role = "admin" | "member";

/**
 * All role-specific colors in one place.
 * `text` is darker than the brand color on purpose: lime (#7aad12) on a pale
 * background is too faint to read, so lime is used only for the bar and icon.
 */
export const TONES = {
  admin: {
    active: "bg-[#f3fbde] border-[#d6f09a] text-[#3f6212]",
    accent: "text-[#7aad12]",
    bar: "bg-[#7aad12]",
    badge: "bg-[#f3fbde] text-[#3f6212] border-[#d6f09a]",
    avatar: "bg-[#111c0a]",
  },
  member: {
    active: "bg-[#e8f4fd] border-[#c0ddf7] text-[#1a5ea8]",
    accent: "text-[#1a5ea8]",
    bar: "bg-[#1a5ea8]",
    badge: "bg-[#e8f4fd] text-[#1a5ea8] border-[#c0ddf7]",
    avatar: "bg-[#1a5ea8]",
  },
} as const;
