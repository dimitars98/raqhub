// The three kinds of signed-in people:
//   super_admin: you, the person who runs Kortello (sees every club)
//   club_admin:  someone who signed their club up and owns it
//   player:      someone who books courts (and may be staff of a club)

/** Where a signed-in person lands, without the locale prefix. */
export function homeFor(role: string | null | undefined): string {
  if (role === "super_admin") return "/admin/owner";
  if (role === "club_admin") return "/admin/dashboard";
  return "/book";
}

/** Club admins and the super admin both use the admin area. */
export const usesAdminArea = (role: string | null | undefined) =>
  role === "club_admin" || role === "super_admin";
