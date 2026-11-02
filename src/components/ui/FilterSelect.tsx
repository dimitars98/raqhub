"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export type FilterOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
  align?: "start" | "end";
};

// A filter pill ("Plan  All plans ⌄") that opens a styled list.
// Radix handles keyboard, typeahead and screen readers.
export default function FilterSelect({ label, value, options, onChange, className = "", align = "start" }: Props) {
  const current = options.find((o) => o.value === value);

  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={`${label}: ${current?.label ?? ""}`}
        className={`group inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-ink-200 bg-white pl-3 pr-2.5 text-[13px] text-[#55664c] outline-none transition-colors hover:border-ink-400 focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/10 data-[state=open]:border-ink-900 ${className}`}
      >
        <span>{label}</span>
        <span className="max-w-[160px] truncate font-medium text-ink-900">
          <Select.Value />
        </span>
        <Select.Icon asChild>
          <ChevronDown
            size={15}
            aria-hidden="true"
            className="shrink-0 text-ink-400 transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          side="bottom"
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[max(var(--radix-select-trigger-width),180px)] overflow-hidden rounded-xl border border-ink-100 bg-white p-1 shadow-[0_12px_32px_-8px_rgba(17,28,10,0.18),0_2px_6px_rgba(17,28,10,0.06)] data-[state=open]:animate-[filter-in_120ms_ease-out]"
        >
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="relative flex h-9 cursor-pointer select-none items-center rounded-lg pl-3 pr-9 text-[13px] text-ink-600 outline-none data-[highlighted]:bg-ink-50 data-[highlighted]:text-ink-900 data-[state=checked]:font-medium data-[state=checked]:text-ink-900"
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-3 inline-flex">
                  <Check size={15} aria-hidden="true" className="text-ink-900" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
