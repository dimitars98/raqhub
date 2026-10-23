"use client";

import { useFormStatus } from "react-dom";

interface Props {
  label: string;
  loadingLabel?: string;
  className?: string;
  /**
   * Pass this when the form is handled in JavaScript (e.g. react-hook-form's
   * isSubmitting). Without it the button follows a form action's status,
   * which only exists for <form action={...}>.
   */
  pending?: boolean;
  /** Not usable for another reason (e.g. read-only); keeps the normal label. */
  disabled?: boolean;
}

export default function SubmitButton({
  label,
  loadingLabel = "Saving…",
  className = "",
  pending: pendingProp,
  disabled = false,
}: Props) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className={`btn-primary disabled:opacity-40 ${className}`}
    >
      {pending ? loadingLabel : label}
    </button>
  );
}
