"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations, useLocale } from "next-intl";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";

export default function MemberNav({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();
  const t = useTranslations("member");
  const locale = useLocale();

  const NAV = [
    { label: t("bookCourt"), href: `/${locale}/book` },
    { label: t("bookCoach"), href: `/${locale}/book/coaches` },
    { label: t("myBookings"), href: `/${locale}/my-bookings` },
    { label: t("membership"), href: `/${locale}/membership` },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = `/${locale}`;
  };

  return (
    <nav className="border-b border-orange-100 bg-[#fff8f2] sticky top-0 z-50">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href={`/${locale}/book`}
          className="text-[15px] font-medium text-orange-900 tracking-tight"
        >
          ServeTime
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                pathname === n.href
                  ? "bg-orange-400 text-white"
                  : "text-orange-700 hover:bg-orange-100"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          <LocaleSwitcher />
          <span className="text-xs text-orange-400">{userName}</span>
          <button
            onClick={handleSignOut}
            className="text-xs text-orange-700 hover:text-orange-900 transition-colors"
          >
            {t("signOut")}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-orange-100 transition-colors"
          aria-label="Toggle menu"
        >
          <span
            className={`block w-5 h-0.5 bg-orange-700 transition-transform duration-200 ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-orange-700 transition-opacity duration-200 ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`block w-5 h-0.5 bg-orange-700 transition-transform duration-200 ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-orange-100 bg-[#fff8f2] px-6 py-4 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`text-sm px-3 py-2.5 rounded-xl transition-colors ${
                pathname === n.href
                  ? "bg-orange-400 text-white"
                  : "text-orange-700 hover:bg-orange-100"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <div className="h-px bg-orange-100 my-2" />
          <div className="px-3 mb-2">
            <LocaleSwitcher />
          </div>
          <div className="flex items-center justify-between px-3">
            <span className="text-xs text-orange-400">{userName}</span>
            <button
              onClick={handleSignOut}
              className="text-xs text-orange-700 hover:text-orange-900 transition-colors"
            >
              {t("signOut")}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
