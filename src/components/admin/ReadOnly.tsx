"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTranslations } from "next-intl";

// True when the club's trial has ended and the account is read-only
// (see clubAccess in src/lib/plans.ts and 20261025_trial_lock.sql).
// The database refuses changes either way; this just disables the buttons
// so nobody fills in a form for nothing.
const ReadOnlyContext = createContext(false);

export function ReadOnlyProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

/** { readOnly, hint }: spread `hint` as the title of a disabled button. */
export function useReadOnly() {
  const readOnly = useContext(ReadOnlyContext);
  const t = useTranslations("billing");
  return { readOnly, hint: readOnly ? t("readOnlyHint") : undefined };
}
