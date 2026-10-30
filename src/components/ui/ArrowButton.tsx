import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export default function ArrowButton({ children }: { children: ReactNode }) {
  return (
    <button className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-900 px-4 text-[13px] font-semibold text-white transition-colors group-hover:bg-brand-600 cursor-pointer">
      {children}
      <ArrowRight
        size={14}
        aria-hidden="true"
        className="transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}
