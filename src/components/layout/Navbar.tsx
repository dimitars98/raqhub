"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { scrollToTop } from "@/helpers/scrollToTop";

import { Link, usePathname, useRouter } from "@/i18n/navigation";

import { useLocale, useTranslations } from "next-intl";

import LocaleSwitcher, { LOCALES } from "@/components/ui/LocaleSwitcher";
import { LogoMark } from "@/components/ui/Logo";
import Image from "next/image";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  // Where the mobile menu starts: right under the bar, which sits lower
  // while the announcement strip above it is still on screen.
  const [menuTop, setMenuTop] = useState(0);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { label: t("features"), href: `/${locale}#features` },
    { label: t("pricing"), href: `/${locale}#pricing` },
    { label: t("how"), href: `/${locale}#how` },
    { label: t("faq"), href: `/${locale}#faq` },
  ];

  const mobileLinks = [
    { label: t("features"), href: `/${locale}#features` },
    { label: t("how"), href: `/${locale}#how` },
    { label: t("pricing"), href: `/${locale}#pricing` },
    { label: t("faq"), href: `/${locale}#faq` },
  ];

  const toggle = () => {
    if (!open) setMenuTop(navRef.current?.getBoundingClientRect().bottom ?? 0);
    setOpen(!open);
  };

  const close = () => setOpen(false);

  const switchLocale = (code: string) => {
    setOpen(false);
    if (code !== locale) router.replace(pathname, { locale: code });
  };

  // While the menu is open: keep the page behind it still, close on Escape,
  // and close if the window grows to the desktop layout.
  useEffect(() => {
    if (!open) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => desktop.matches && setOpen(false);

    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onResize);
    };
  }, [open]);

  return (
    <nav
      ref={navRef}
      className="border-b border-brand-200 bg-white sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between relative">
        {/* Logo */}
        <Link
          href="/"
          onClick={() => {
            close();
            scrollToTop();
          }}
          className="inline-flex shrink-0 items-center gap-2 text-lg font-semibold text-brand-900 tracking-tight cursor-pointer"
        >
          {/* <LogoMark className="size-7" /> */}
          <Image src="/logo2_dark.png" alt="logo" width={40} height={40} />
          Korto
        </Link>

        {/* Center links — share the row with logo and buttons, so longer
            translations push things apart instead of overlapping */}
        <div className="hidden lg:flex flex-1 justify-center items-center gap-1 px-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onMouseEnter={() => setHoveredLink(link.label)}
              onMouseLeave={() => setHoveredLink(null)}
              className="relative whitespace-nowrap px-3 py-2 text-base font-medium transition-colors duration-200"
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
        <div className="hidden lg:flex shrink-0 items-center gap-2 whitespace-nowrap">
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

        {/* Mobile menu button */}
        <button
          ref={toggleRef}
          type="button"
          onClick={toggle}
          aria-label={tc("toggleMenu")}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="lg:hidden -mr-2 flex size-11 flex-col items-center justify-center gap-1.5 rounded-full transition-colors active:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <span
            className={`block h-0.5 w-5 rounded-full bg-ink-900 transition-transform duration-200 ${
              open ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-ink-900 transition-opacity duration-200 ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-ink-900 transition-transform duration-200 ${
              open ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu: fills the screen under the bar */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ top: menuTop }}
            className="lg:hidden fixed inset-x-0 bottom-0 flex flex-col overflow-y-auto overscroll-contain border-t border-brand-200 bg-white"
          >
            <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6">
              {/* Page sections */}
              <ul className="py-2">
                {mobileLinks.map((link, i) => (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + i * 0.03, duration: 0.2 }}
                    className="border-b border-ink-100"
                  >
                    <a
                      href={link.href}
                      onClick={close}
                      className="group flex items-center justify-between gap-4 py-4 text-xl font-semibold tracking-tight text-ink-900"
                    >
                      {link.label}
                      <ArrowRight
                        size={18}
                        aria-hidden="true"
                        className="shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5"
                      />
                    </a>
                  </motion.li>
                ))}
              </ul>

              {/* Language: all options on view, one tap to switch */}
              <div className="py-5">
                <p
                  id="mobile-language"
                  className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400"
                >
                  {t("language")}
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby="mobile-language"
                  className="grid grid-cols-7 gap-1.5"
                >
                  {LOCALES.map((l) => {
                    const active = l.code === locale;
                    return (
                      <button
                        key={l.code}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={l.name}
                        lang={l.code}
                        onClick={() => switchLocale(l.code)}
                        className={`h-10 rounded-full border text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                          active
                            ? "border-ink-900 bg-ink-900 text-white"
                            : "border-ink-200 text-ink-600 active:bg-ink-50"
                        }`}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accounts, kept at the bottom within thumb reach */}
              <div className="mt-auto flex flex-col gap-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
                <Link
                  href="/signup?role=admin"
                  onClick={close}
                  className="btn-primary h-12 w-full justify-center text-[15px] font-semibold"
                >
                  {t("forClubs")}
                </Link>
                <Link
                  href="/login"
                  onClick={close}
                  className="btn-secondary flex h-12 w-full items-center justify-center text-[15px] font-semibold"
                >
                  {t("signIn")}
                </Link>
                <Link
                  href="/signup?role=player"
                  onClick={close}
                  className="flex h-11 items-center justify-center text-sm font-medium text-ink-600 underline-offset-4 active:underline"
                >
                  {t("imPlayer")}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
