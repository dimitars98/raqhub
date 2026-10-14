import { SALES_EMAIL } from "@/lib/plans";

// How clubs pay for their ServeTime plan, shown on the plan card in Settings.
//
// Fill in your bank details before going live. While `iban` is empty, clubs
// are asked to write to you for the details instead. Lines left as null are
// not shown.
export const PAYMENT = {
  /** Where clubs write about paying, invoices and changing plan. */
  email: SALES_EMAIL,
  phone: null as string | null, // e.g. "+389 70 123 456"

  bank: {
    holder: null as string | null, // name on the account
    iban: null as string | null, // e.g. "MK07 2501 2000 0058 984"
    bankName: null as string | null,
    swift: null as string | null, // only needed for payments from abroad
  },

  /** Offer paying in cash, in person. */
  inPerson: true,
};

/** What a club writes on its transfer so you can tell who paid. */
export function paymentReference(slug: string) {
  return `ST ${slug}`.slice(0, 35).toUpperCase();
}
