import { SALES_EMAIL } from "@/lib/plans";

// Details shown on the Privacy Policy and Terms of Service pages.
//
// Fill in `operator` and `address` with who legally runs Kortello (your
// name as a sole trader, or your company's registered name) before going
// live. Lines left as null are simply not shown.
export const LEGAL = {
  operator: "Dimitar Stoilov" as string | null, // or a company name once registered, e.g. "Kortello DOOEL"
  address: "Partizanska 14, 2310 Vinica, North Macedonia" as string | null,
  email: SALES_EMAIL,
  /** Change this whenever the wording of either page changes. */
  updated: "2026-10-27",
};
