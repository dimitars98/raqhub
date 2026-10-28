"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ChevronDown,
  CircleQuestionMark,
  Mail,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { reportProblem } from "@/app/actions/help";
import { SALES_EMAIL } from "@/lib/plans";
import { allTopics, fold, generalTopics, topicsForPage } from "@/lib/help";
import type { Area } from "@/lib/notifications";

/**
 * The help button in the top bar. Opens a panel on the right with answers
 * for the page you're on, a search over all of them, what's new, and a way
 * to reach us. The page stays visible on large screens, so people can read
 * the steps and follow them at the same time.
 */
export default function Help({ area }: { area: Area }) {
  const t = useTranslations("help");
  const pathname = usePathname();
  // The page it was opened on: going to another page (e.g. by a link in it) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenOn(pathname)}
        aria-label={t("open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={t("open")}
        className="relative grid size-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-900"
      >
        <CircleQuestionMark
          className="fill-ink-400 stroke-white"
          aria-hidden="true"
        />
      </button>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>
          {open && (
            <Panel
              area={area}
              pathname={pathname}
              onClose={() => {
                setOpenOn(null);
                buttonRef.current?.focus();
              }}
            />
          )}
        </AnimatePresence>
      </MotionConfig>
    </>
  );
}

function Panel({
  area,
  pathname,
  onClose,
}: {
  area: Area;
  pathname: string;
  onClose: () => void;
}) {
  const t = useTranslations("help");
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  // Escape closes, Tab stays inside, the search box gets focus.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input, textarea, summary",
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const pageTopics = topicsForPage(pathname, area);
  const general = generalTopics(area, pageTopics);
  const q = fold(query.trim());
  const results = q
    ? allTopics(area).filter((id) =>
        q
          .split(/\s+/)
          .every((word) =>
            fold(`${t(`topics.${id}.q`)} ${t(`topics.${id}.a`)}`).includes(
              word,
            ),
          ),
      )
    : [];
  const news = t.raw("news.items") as {
    date: string;
    title: string;
    body: string;
  }[];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* On phones the panel covers the page; on large screens it dims it a little. */}
      <motion.div
        className="absolute inset-0 bg-black/25"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="relative flex h-full w-full max-w-[420px] flex-col bg-[#f8f9f7] shadow-2xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-ink-100 bg-white px-5">
          <h2
            id="help-title"
            className="font-display text-base font-bold text-ink-900"
          >
            {t("title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid size-9 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-900"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-6 p-5">
            {/* Search */}
            <div className="relative">
              <label htmlFor="help-search" className="sr-only">
                {t("search")}
              </label>
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
              />
              <input
                id="help-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="input pl-10"
                autoComplete="off"
              />
            </div>

            {q ? (
              <Section title={t("results", { n: results.length })} live>
                {results.length ? (
                  <Topics ids={results} />
                ) : (
                  <p className="text-sm text-ink-600">{t("noResults")}</p>
                )}
              </Section>
            ) : (
              <>
                {pageTopics.length > 0 && (
                  <Section title={t("onThisPage")}>
                    <Topics ids={pageTopics} openFirst />
                  </Section>
                )}

                {area === "admin" && !pathname.includes("/admin/dashboard") && (
                  <Link
                    href="/admin/dashboard"
                    className="flex flex-col gap-1 rounded-2xl bg-ink-900 p-4 text-white transition-colors hover:bg-ink-800"
                  >
                    <span className="text-[15px] font-bold">
                      {t("gettingStarted.title")}
                    </span>
                    <span className="text-[13px] leading-relaxed text-ink-200">
                      {t("gettingStarted.body")}
                    </span>
                    <span className="mt-1 text-[13px] font-semibold text-brand-400">
                      {t("gettingStarted.cta")} →
                    </span>
                  </Link>
                )}

                {general.length > 0 && (
                  <Section title={t("general")}>
                    <Topics ids={general} />
                  </Section>
                )}

                {news.length > 0 && (
                  <Section title={t("news.title")}>
                    <ul className="flex flex-col gap-2">
                      {news.map((n) => (
                        <li
                          key={n.title}
                          className="flex gap-3 rounded-2xl border border-ink-100 bg-white p-3.5"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-800">
                            <Sparkles size={15} aria-hidden="true" />
                          </span>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-[13px] font-semibold text-ink-900">
                              {n.title}{" "}
                              <span className="font-normal text-ink-400">
                                · {n.date}
                              </span>
                            </span>
                            <span className="text-[13px] leading-relaxed text-ink-600">
                              {n.body}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </>
            )}

            <Contact area={area} pathname={pathname} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Section({
  title,
  children,
  live,
}: {
  title: string;
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3
        className="text-[11px] font-bold tracking-[.08em] text-ink-600 uppercase"
        aria-live={live ? "polite" : undefined}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Questions that open to show their answer. */
function Topics({
  ids,
  openFirst = false,
}: {
  ids: string[];
  openFirst?: boolean;
}) {
  const t = useTranslations("help.topics");
  return (
    <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
      {ids.map((id, i) => (
        <details key={id} open={openFirst && i === 0} className="group">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-ink-900 hover:bg-ink-50 [&::-webkit-details-marker]:hidden">
            {t(`${id}.q`)}
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="px-4 pb-4 text-[13px] leading-relaxed text-ink-600">
            {t(`${id}.a`)}
          </p>
        </details>
      ))}
    </div>
  );
}

function Contact({ area, pathname }: { area: Area; pathname: string }) {
  const t = useTranslations("help.contact");
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "failed" | "short">(
    "idle",
  );
  const [pending, startTransition] = useTransition();

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 5) {
      setState("short");
      return;
    }
    startTransition(async () => {
      const r = await reportProblem(text, pathname);
      setState(r.ok ? "sent" : "failed");
      if (r.ok) setText("");
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4">
      <h3 className="text-[15px] font-bold text-ink-900">{t("title")}</h3>
      <p className="-mt-1 text-[13px] leading-relaxed text-ink-600">
        {area === "admin" ? t("adminBody") : t("memberBody")}
      </p>
      <a
        href={`mailto:${SALES_EMAIL}`}
        className="btn-secondary flex w-fit gap-2 px-4 py-2 text-[13px]"
      >
        <Mail size={15} aria-hidden="true" />
        {t("email")}
      </a>

      <form
        onSubmit={send}
        className="mt-1 flex flex-col gap-2 border-t border-ink-100 pt-3"
      >
        <label
          htmlFor="help-report"
          className="text-[13px] font-semibold text-ink-900"
        >
          {t("reportTitle")}
        </label>
        {state === "sent" ? (
          <p
            role="status"
            className="rounded-xl bg-brand-50 px-3 py-2.5 text-[13px] text-brand-900"
          >
            {t("sent")}
          </p>
        ) : (
          <>
            <textarea
              id="help-report"
              rows={3}
              maxLength={2000}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (state !== "idle") setState("idle");
              }}
              placeholder={t("reportPlaceholder")}
              className="input resize-none text-[13px]"
            />
            <span className="text-[11px] text-ink-400">{t("reportNote")}</span>
            {(state === "failed" || state === "short") && (
              <p role="alert" className="text-xs text-red-600">
                {state === "failed" ? t("failed") : t("tooShort")}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-fit px-4 py-2 text-[13px]"
            >
              {pending ? t("sending") : t("send")}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
