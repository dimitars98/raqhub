"use client";

import { Printer } from "lucide-react";

export default function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-primary inline-flex items-center gap-2"
    >
      <Printer size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
