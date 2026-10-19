import { SALES_EMAIL } from "@/lib/plans";

// Details shown on the Privacy Policy and Terms of Service pages.
//
// Fill in `operator` and `address` with who legally runs Kortello (your
// name as a sole trader, or your company's registered name) before going
// live. Lines left as null are simply not shown.
export const LEGAL = {
  operator: null as string | null, // e.g. "Dimitar Stoilov" or "Kortello DOOEL"
  address: null as string | null, // e.g. "Street 1, 1000 Skopje, North Macedonia"
  email: SALES_EMAIL,
  /** Change this whenever the wording of either page changes. */
  updated: "2026-10-14",
};
