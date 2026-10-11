"use client";

import { useFormStatus } from "react-dom";

interface Props {
  label: string;
  loadingLabel?: string;
  className?: string;
}

export default function SubmitButton({
  label,
  loadingLabel = "Saving…",
  className = "",
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`btn-primary disabled:opacity-40 ${className}`}
    >
      {pending ? loadingLabel : label}
    </button>
  );
}
