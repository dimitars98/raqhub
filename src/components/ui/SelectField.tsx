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
  /** md: a form field · sm: 36px, inside a row · xs: 32px, small text, in a table */
  size?: "md" | "sm" | "xs";
  /** Tooltip on the button (e.g. why it's disabled). */
  title?: string;
  /** Shows the field in red, for a missing required choice. */
  invalid?: boolean;
};

// Radix doesn't allow "" as an item value, but forms often use it for
// "none" ("No plan", "Select a court"). It's swapped for this inside.
const EMPTY = "__empty__";
const toRadix = (v: string) => (v === "" ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? "" : v);

const SIZES = {
  md: "h-11 rounded-xl pl-4 pr-3 text-sm",
  sm: "h-9 rounded-xl pl-3 pr-2.5 text-sm",
  xs: "h-8 rounded-full pl-3 pr-2 text-xs",
};

// A form field that opens a styled list: the field-sized sibling of
// FilterSelect. Radix handles keyboard, typeahead and screen readers.
export default function SelectField({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  size = "md",
  title,
  invalid,
}: Props) {
  return (
    <Select.Root value={toRadix(value)} onValueChange={(v) => onChange(fromRadix(v))} disabled={disabled}>
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        title={title}
        className={`group flex w-full cursor-pointer items-center justify-between gap-2 border bg-white text-left text-ink-900 outline-none transition-colors hover:border-ink-400 focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-ink-900 ${
          invalid ? "border-red-400" : "border-ink-200"
        } ${SIZES[size]}`}
      >
        <span className="min-w-0 truncate">
          <Select.Value />
        </span>
        <Select.Icon asChild>
          <ChevronDown
            size={size === "xs" ? 14 : 16}
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
                value={toRadix(o.value)}
                className={`relative flex cursor-pointer items-center rounded-lg pr-9 pl-3 text-ink-600 ${
                  size === "xs" ? "min-h-8 py-1.5 text-xs" : "min-h-10 py-2 text-sm"
                } outline-none select-none data-[highlighted]:bg-ink-50 data-[highlighted]:text-ink-900 data-[state=checked]:font-medium data-[state=checked]:text-ink-900`}
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
