"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, usePathname } from "@/i18n/navigation";
import { LogOut, Menu, X } from "lucide-react";
import type { ElementType } from "react";

export type MobileNavItem = {
  label: string;
  href: string;
  icon: ElementType;
};

type MobileBottomNavProps = {
  items: MobileNavItem[];
  moreItems: MobileNavItem[];
  onSignOut: () => void | Promise<void>;
  signOutLabel: string;
};

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export default function MobileBottomNav({
  items,
  moreItems,
  onSignOut,
  signOutLabel,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  useEffect(() => {
    if (!moreOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("button")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        return;
      }

      if (event.key !== "Tab" || !sheetRef.current) return;

      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ),
      );

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      moreButtonRef.current?.focus();
    };
  }, [moreOpen]);

  async function handleMobileSignOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      await onSignOut();
      setMoreOpen(false);
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 rounded-t-[24px] border-t border-white/10 bg-[#111c0a] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(0,0,0,0.12)] lg:hidden"
      >
        <div className="mx-auto flex h-[72px] max-w-xl items-center justify-around px-2">
          {items.map(({ label, href, icon: Icon }) => {
            const active = isActive(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full py-1 focus-visible:outline-2 focus-visible:outline-[#a8d832]"
              >
                <span
                  className={`flex h-9 w-14 items-center justify-center rounded-full transition-colors duration-200 ${
                    active ? "bg-[#a8d832]/15" : ""
                  }`}
                >
                  <Icon
                    size={21}
                    strokeWidth={active ? 2.5 : 1.8}
                    className={active ? "text-[#a8d832]" : "text-white/65"}
                    aria-hidden="true"
                  />
                </span>

                <span
                  className={`max-w-full truncate px-1 text-[10px] ${
                    active
                      ? "font-semibold text-[#a8d832]"
                      : "font-medium text-white/65"
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          <button
            ref={moreButtonRef}
            type="button"
            aria-label="More navigation options"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full py-1 focus-visible:outline-2 focus-visible:outline-[#a8d832]"
          >
            <span
              className={`flex h-9 w-14 items-center justify-center rounded-full ${
                moreActive || moreOpen ? "bg-[#a8d832]/15" : ""
              }`}
            >
              <Menu
                size={21}
                strokeWidth={moreActive || moreOpen ? 2.5 : 1.8}
                className={
                  moreActive || moreOpen ? "text-[#a8d832]" : "text-white/65"
                }
                aria-hidden="true"
              />
            </span>

            <span
              className={`text-[10px] ${
                moreActive || moreOpen
                  ? "font-semibold text-[#a8d832]"
                  : "font-medium text-white/65"
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
          >
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMoreOpen(false)}
            />

            <motion.div
              ref={sheetRef}
              className="relative z-10 flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-[#f8f9f7] shadow-2xl"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                stiffness: 350,
                damping: 35,
              }}
            >
              <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-gray-300" />

              <div className="flex items-center justify-between px-6 py-5">
                <h2 className="text-xl font-bold text-[#111c0a]">More</h2>

                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMoreOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-gray-200/70 text-gray-600 hover:bg-gray-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-4 pb-[calc(24px+env(safe-area-inset-bottom))]">
                <div className="space-y-2">
                  {moreItems.map(({ label, href, icon: Icon }) => {
                    const active = isActive(pathname, href);

                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMoreOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-14 items-center gap-4 rounded-full border px-4 transition-colors ${
                          active
                            ? "border-[#a8d832]/40 bg-[#a8d832]/10 text-[#111c0a]"
                            : "border-gray-200/70 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <Icon
                          size={20}
                          className={
                            active ? "text-[#557b16]" : "text-gray-500"
                          }
                        />

                        <span className="flex-1 text-sm font-semibold">
                          {label}
                        </span>

                        <span className="text-gray-400">›</span>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-5 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={handleMobileSignOut}
                    disabled={signingOut}
                    className="flex min-h-14 w-full items-center gap-4 rounded-full px-4 text-left text-red-600 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <LogOut size={20} strokeWidth={1.8} aria-hidden="true" />

                    <span className="flex-1 text-sm font-semibold">
                      {signingOut ? "Signing out..." : signOutLabel}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
