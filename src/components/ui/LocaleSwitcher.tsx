"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Globe } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useClickOutside } from "@/hooks/useClickOutside";
import { GB, MK, AL, DE, FR, IT, RS } from "country-flag-icons/react/3x2";

// Every language in src/messages, each named in its own language.
export const LOCALES = [
  { code: "en", label: "EN", name: "English", flagCode: "GB" },
  { code: "mk", label: "МК", name: "Македонски", flagCode: "MK" },
  { code: "sq", label: "SQ", name: "Shqip", flagCode: "AL" },
  { code: "de", label: "DE", name: "Deutsch", flagCode: "DE" },
  { code: "fr", label: "FR", name: "Français", flagCode: "FR" },
  { code: "it", label: "IT", name: "Italiano", flagCode: "IT" },
  { code: "sr", label: "SR", name: "Srpski", flagCode: "RS" },
];

const FLAGS = {
  GB,
  MK,
  AL,
  DE,
  FR,
  IT,
  RS,
};

type LocaleSwitcherProps = {
  /** Which edge of the trigger the menu lines up with */
  align?: "left" | "right";
  /** "md" for the marketing navbar, "sm" for the dashboard */
  size?: "md" | "sm";
};

export default function LocaleSwitcher({
  align = "right",
  size = "md",
}: LocaleSwitcherProps) {
  const locale = useLocale();
  const tc = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const currentIndex = Math.max(
    0,
    LOCALES.findIndex((l) => l.code === locale),
  );
  const current = LOCALES[currentIndex];

  useClickOutside(containerRef, () => setOpen(false));

  // Move focus to the active locale when the menu opens
  useEffect(() => {
    if (open) itemRefs.current[currentIndex]?.focus();
  }, [open, currentIndex]);

  const switchLocale = (newLocale: string) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (newLocale !== locale) {
      router.replace(pathname, { locale: newLocale });
    }
  };

  const focusItem = (index: number) => {
    const count = LOCALES.length;
    itemRefs.current[(index + count) % count]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    const focused = itemRefs.current.findIndex(
      (el) => el === document.activeElement,
    );

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        focusItem(focused + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(focused - 1);
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(LOCALES.length - 1);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ease-in-out ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        ref={containerRef}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="relative z-50 inline-block"
        onKeyDown={onKeyDown}
      >
        {/* Trigger */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Language: ${current.name}`}
          className={`flex items-center gap-1.5 rounded-full border text-sm font-medium cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
            size === "sm" ? "h-9 px-3.5" : "h-12 px-5"
          } ${
            open
              ? "border-ink-200 bg-ink-50 text-ink-900"
              : "border-ink-200 text-ink-600 hover:border-brand-600 hover:bg-brand-50"
          }`}
        >
          <Globe className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {/* <span>{current.label}</span> */}
          <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full">
            {(() => {
              const Flag = FLAGS[current.flagCode as keyof typeof FLAGS];

              return (
                <Flag
                  title={current.name}
                  className="absolute left-1/2 top-1/2 h-full w-auto max-w-none -translate-x-1/2 -translate-y-1/2"
                />
              );
            })()}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            strokeWidth={2.25}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-full h-2"
          />
        )}

        {/* Menu */}
        <div
          role="menu"
          aria-label={tc("selectLanguage")}
          className={`absolute z-50 mt-2 min-w-44 rounded-2xl border border-ink-100 bg-white p-1.5 shadow-lg shadow-black/10 transition-[opacity,transform, visibility] duration-200 ease-out ${
            align === "left"
              ? "left-0 origin-top-left"
              : "right-0 origin-top-right"
          } ${
            open
              ? "visible translate-y-0 opacity-100"
              : "invisible pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          {LOCALES.map((l, i) => {
            const active = l.code === locale;
            return (
              <button
                key={l.code}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                tabIndex={open ? 0 : -1}
                onClick={() => switchLocale(l.code)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm cursor-pointer transition-colors focus:outline-none ${
                  active
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50 hover:text-brand-600 focus-visible:bg-ink-50"
                }`}
              >
                {/* <span
                  className={`w-6 text-xs font-semibold ${
                    active ? "text-white/80" : "text-ink-400"
                  }`}
                >
                  {l.label}
                </span> */}
                <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full">
                  {(() => {
                    const Flag = FLAGS[l.flagCode as keyof typeof FLAGS];

                    return (
                      <Flag
                        title={l.name}
                        className="absolute left-1/2 top-1/2 h-full w-auto max-w-none -translate-x-1/2 -translate-y-1/2"
                      />
                    );
                  })()}
                </span>
                <span className="flex-1 whitespace-nowrap">{l.name}</span>
                {active && (
                  <Check
                    className="h-3.5 w-3.5"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
