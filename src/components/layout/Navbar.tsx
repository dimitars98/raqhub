"use client";

import { useState } from "react";

import { scrollToTop } from "@/helpers/scrollToTop";

import { Link } from "@/i18n/navigation";

import { useTranslations } from "next-intl";

import LocaleSwitcher from "@/components/ui/LocaleSwitcher";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const t = useTranslations("nav");

  const links = [
    { label: t("features"), href: "#features" },
    { label: t("pricing"), href: "#pricing" },
  ];

  return (
    <nav className="border-b border-brand-200 bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative">
        {/* Logo */}
        <Link
          href="/"
          onClick={() => scrollToTop()}
          className="text-lg font-semibold text-brand-900 tracking-tight cursor-pointer"
        >
          ServeTime
        </Link>

        {/* Center links — absolutely centered */}
        <div className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onMouseEnter={() => setHoveredLink(link.label)}
              onMouseLeave={() => setHoveredLink(null)}
              className="relative px-3 py-2 text-base font-medium transition-colors duration-200"
              style={{
                color:
                  hoveredLink === null
                    ? "#111c0a"
                    : hoveredLink === link.label
                      ? "#111c0a"
                      : "#d0d9c9",
              }}
            >
              {link.label}

              <span
                className="absolute bottom-0 left-3 right-3 h-[1.5px] bg-ink-900 transition-transform duration-200 origin-left"
                style={{
                  transform:
                    hoveredLink === link.label ? "scaleX(1)" : "scaleX(0)",
                }}
              />
            </a>
          ))}
        </div>

        {/* Right actions */}
        <div className="hidden lg:flex items-center gap-2">
          <LocaleSwitcher />

          <Link
            href="/login"
            className="btn-ghost btn-lg text-sm font-semibold"
          >
            {t("signIn")}
          </Link>

          <Link
            href="/signup?role=player"
            className="btn-ghost btn-lg text-sm font-semibold"
          >
            {t("imPlayer")}
          </Link>

          <Link
            href="/signup?role=admin"
            className="btn-primary btn-lg text-sm font-semibold"
          >
            {t("forClubs")}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="lg:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-brand-100 transition-colors"
          aria-label="Toggle menu"
        >
          <span
            className={`block w-5 h-0.5 bg-brand-800 transition-transform duration-200 ${
              open ? "translate-y-2 rotate-45" : ""
            }`}
          />

          <span
            className={`block w-5 h-0.5 bg-brand-800 transition-opacity duration-200 ${
              open ? "opacity-0" : ""
            }`}
          />

          <span
            className={`block w-5 h-0.5 bg-brand-800 transition-transform duration-200 ${
              open ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden border-t border-brand-200 bg-brand-50 px-6 py-4 flex flex-col gap-2">
          <Link
            href="#features"
            onClick={() => setOpen(false)}
            className="text-sm text-brand-800 py-2 hover:text-brand-900 transition-colors"
          >
            {t("features")}
          </Link>

          <Link
            href="#pricing"
            onClick={() => setOpen(false)}
            className="text-sm text-brand-800 py-2 hover:text-brand-900 transition-colors"
          >
            {t("pricing")}
          </Link>

          <div className="h-px bg-brand-200 my-1" />

          <div className="py-1">
            <LocaleSwitcher />
          </div>

          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="btn-secondary text-sm text-center"
          >
            {t("signIn")}
          </Link>

          <Link
            href="/signup?role=admin"
            onClick={() => setOpen(false)}
            className="btn-primary text-sm text-center"
          >
            {t("forClubs")}
          </Link>

          <Link
            href="/signup?role=player"
            onClick={() => setOpen(false)}
            className="btn-ghost text-sm text-center"
          >
            {t("imPlayer")}
          </Link>
        </div>
      )}
    </nav>
  );
}
