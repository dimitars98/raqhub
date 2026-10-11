"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLocale, useTranslations } from "next-intl";

export default function AdminNav({
  clubName,
  userName,
}: {
  clubName: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const supabase = createClient();
  const t = useTranslations("admin");
  const locale = useLocale();

  const NAV = [
    { label: t("timetable"), href: `/${locale}/admin/timetable` },
    { label: t("members"), href: `/${locale}/admin/members` },
    { label: t("plans"), href: `/${locale}/admin/plans` },
    { label: t("courts"), href: `/${locale}/admin/courts` },
    { label: t("bookings"), href: `/${locale}/admin/bookings` },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = `/${locale}`;
  };

  return (
    <nav className="border-b border-orange-100 bg-[#fff8f2] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left — club name + desktop nav */}
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-orange-900 truncate max-w-[120px] sm:max-w-none">
            {clubName}
          </span>
          <div className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  pathname.startsWith(n.href)
                    ? "bg-orange-400 text-white"
                    : "text-orange-700 hover:bg-orange-100"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right — user + sign out (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs text-orange-500">
            {userName}
          </span>
          <button
            onClick={handleSignOut}
            className="hidden md:block text-xs text-orange-700 hover:text-orange-900 transition-colors"
          >
            Sign out
          </button>
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
                pathname.startsWith(n.href)
                  ? "bg-orange-400 text-white"
                  : "text-orange-700 hover:bg-orange-100"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <div className="h-px bg-orange-100 my-2" />
          <div className="flex items-center justify-between px-3">
            <span className="text-xs text-orange-500">{userName}</span>
            <button
              onClick={handleSignOut}
              className="text-xs text-orange-700 hover:text-orange-900 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
