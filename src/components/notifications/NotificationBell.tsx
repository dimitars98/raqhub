"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useClickOutside } from "@/hooks/useClickOutside";
import {
  BELL_SIZE,
  type Area,
  type NotificationRow,
} from "@/lib/notifications";
import NotificationItem, { splitByDay } from "./NotificationItem";
import { useNotifications } from "./useNotifications";

/** The bell in the top bar: unread count, and the latest notifications under it. */
export default function NotificationBell({
  userId,
  area,
}: {
  userId: string;
  area: Area;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const { items, unread, loaded, markRead, markAllRead } = useNotifications({
    userId,
    size: BELL_SIZE,
    unreadOnly,
  });
  const pageHref = area === "admin" ? "/admin/notifications" : "/notifications";

  useClickOutside(box, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openOne = (n: NotificationRow) => {
    if (!n.read_at) markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const { today, earlier } = splitByDay(items);
  const group = (label: string, list: NotificationRow[]) =>
    list.length > 0 && (
      <div>
        <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6e7f65]">
          {label}
        </p>
        <ul>
          {list.map((n) => (
            <li key={n.id}>
              <NotificationItem n={n} onOpen={openOne} />
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("bell", { n: unread })}
        className={`relative grid size-9 place-items-center rounded-lg transition-colors cursor-pointer ${
          open ? "bg-[#f3fbde] text-ink-900" : "text-ink-400 hover:bg-ink-50"
        }`}
      >
        <Bell className="size-5" strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-white bg-brand-600 px-1 text-[10px] font-bold leading-none text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="fixed inset-x-2 top-[64px] z-50 flex max-h-[calc(100dvh-80px)] flex-col overflow-hidden rounded-2xl border border-[#e8ede4] bg-white shadow-[0_30px_60px_-30px_rgba(17,28,10,0.45)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[400px] sm:max-h-[min(640px,calc(100dvh-90px))]"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
            <p className="text-[15px] font-bold text-[#111c0a]">{t("title")}</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-lg px-2 py-1 text-xs font-medium text-[#4d7a08] hover:bg-[#f3fbde]"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>
          <div
            role="tablist"
            aria-label={t("title")}
            className="flex gap-1.5 border-b border-[#e8ede4] px-4 pb-3"
          >
            {[false, true].map((only) => (
              <button
                key={String(only)}
                type="button"
                role="tab"
                aria-selected={unreadOnly === only}
                onClick={() => setUnreadOnly(only)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  unreadOnly === only
                    ? "border-[#111c0a] bg-[#111c0a] font-semibold text-white"
                    : "border-[#e8ede4] text-[#3d4f35] hover:border-[#d0d9c9]"
                }`}
              >
                {only ? t("unread") : t("all")}
                {only && unread > 0 && (
                  <span className="ml-1 font-bold">{unread}</span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {!loaded ? null : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[#6e7f65]">
                {unreadOnly ? t("emptyUnread") : t("empty")}
              </p>
            ) : (
              <>
                {group(t("today"), today)}
                {group(t("earlier"), earlier)}
              </>
            )}
          </div>

          <Link
            href={pageHref}
            onClick={() => setOpen(false)}
            className="block border-t border-[#e8ede4] px-4 py-3 text-center text-[13px] font-semibold text-[#111c0a] hover:bg-[#f8f9f7]"
          >
            {t("seeAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
