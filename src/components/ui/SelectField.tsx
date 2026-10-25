"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string };

type Props = {
  /** Lets a <label htmlFor> point at it. */
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** When there is no visible label. */
  ariaLabel?: string;
  disabled?: boolean;
  /** "sm": 36px tall, for short lists inside a row. */
  size?: "md" | "sm";
};

// A form field that opens a styled list: the field-sized sibling of
// FilterSelect. Radix handles keyboard, typeahead and screen readers.
export default function SelectField({ id, value, options, onChange, ariaLabel, disabled, size = "md" }: Props) {
  return (
    <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        className={`group flex ${size === "sm" ? "h-9" : "h-11"} w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-ink-200 bg-white pr-3 pl-4 text-left text-sm text-ink-900 outline-none transition-colors hover:border-ink-400 focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-ink-900`}
      >
        <span className="min-w-0 truncate">
          <Select.Value />
        </span>
        <Select.Icon asChild>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="shrink-0 text-ink-400 transition-transform duration-150 group-data-[state=open]:rotate-180"
          />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[1000] max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-ink-100 bg-white p-1 shadow-[0_12px_32px_-8px_rgba(17,28,10,0.18),0_2px_6px_rgba(17,28,10,0.06)] data-[state=open]:animate-[filter-in_120ms_ease-out]"
        >
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="relative flex min-h-10 cursor-pointer items-center rounded-lg py-2 pr-9 pl-3 text-sm text-ink-600 outline-none select-none data-[highlighted]:bg-ink-50 data-[highlighted]:text-ink-900 data-[state=checked]:font-medium data-[state=checked]:text-ink-900"
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
