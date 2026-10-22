"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
  FILTERS,
  OWNER_ONLY,
  PAGE_SIZE,
  type Area,
  type NotificationRow,
} from "@/lib/notifications";
import NotificationItem, { splitByDay } from "./NotificationItem";
import { useNotifications } from "./useNotifications";

/** The notifications page: everything from the last 60 days, and what you get. */
export default function NotificationsView({
  userId,
  area,
  isOwner = false,
}: {
  userId: string;
  area: Area;
  /** Club owners also get the staff switch and the plan line. */
  isOwner?: boolean;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [filter, setFilter] = useState<string>("all");
  const filters = FILTERS[area];
  const { items, unread, loaded, hasMore, showMore, markRead, markAllRead } = useNotifications({
    userId,
    size: PAGE_SIZE,
    unreadOnly: filter === "unread",
    kinds: filter in filters ? filters[filter] : null,
  });

  const openOne = (n: NotificationRow) => {
    if (!n.read_at) markRead(n.id);
    if (n.link) router.push(n.link);
  };

  const { today, earlier } = splitByDay(items);
  const tabs = ["all", "unread", ...Object.keys(filters)];

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-[#111c0a]">{t("title")}</h1>
          {unread > 0 && (
            <button type="button" onClick={markAllRead} className="btn-secondary text-[13px]">
              {t("markAllRead")}
            </button>
          )}
        </div>

        <div role="tablist" aria-label={t("title")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filter === tab}
              onClick={() => setFilter(tab)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] transition-colors ${
                filter === tab
                  ? "border-[#111c0a] bg-[#111c0a] font-semibold text-white"
                  : "border-[#e8ede4] bg-white text-[#3d4f35] hover:border-[#d0d9c9]"
              }`}
            >
              {tab === "all" || tab === "unread" ? t(tab) : t(`filters.${tab}`)}
              {tab === "unread" && unread > 0 && <span className="ml-1.5 font-bold">{unread}</span>}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e8ede4] bg-white">
          {!loaded ? (
            <p className="px-5 py-12 text-center text-sm text-[#6e7f65]">…</p>
          ) : items.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[#6e7f65]">
              {filter === "unread" ? t("emptyUnread") : t("empty")}
            </p>
          ) : (
            [
              [t("today"), today],
              [t("earlier"), earlier],
            ].map(
              ([label, list]) =>
                (list as NotificationRow[]).length > 0 && (
                  <div key={label as string} className="border-b border-[#eef2ea] last:border-0">
                    <p className="px-5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6e7f65]">
                      {label as string}
                    </p>
                    <ul className="divide-y divide-[#eef2ea]">
                      {(list as NotificationRow[]).map((n) => (
                        <li key={n.id}>
                          <NotificationItem n={n} onOpen={openOne} roomy />
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )
          )}
        </div>
        {hasMore && (
          <button type="button" onClick={showMore} className="btn-secondary self-center text-[13px]">
            {t("loadMore")}
          </button>
        )}
        <p className="text-xs text-[#6e7f65]">{t("kept")}</p>
      </section>

      <Preferences userId={userId} area={area} isOwner={isOwner} />
    </div>
  );
}

/** The on/off switches, saved for this person only. */
function Preferences({ userId, area, isOwner }: { userId: string; area: Area; isOwner: boolean }) {
  const t = useTranslations("notifications.settings");
  const [muted, setMuted] = useState<string[] | null>(null);
  const [error, setError] = useState(false);
  const [supabase] = useState(() => createClient());
  const categories = CATEGORIES[area].filter((c) => isOwner || !OWNER_ONLY.includes(c));

  useEffect(() => {
    supabase
      .from("notification_prefs")
      .select("muted")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setMuted(data?.muted ?? []));
  }, [supabase, userId]);

  const toggle = async (category: string) => {
    if (!muted) return;
    const before = muted;
    const next = muted.includes(category) ? muted.filter((c) => c !== category) : [...muted, category];
    setMuted(next);
    setError(false);
    const { error: saveError } = await supabase
      .from("notification_prefs")
      .upsert({ user_id: userId, muted: next, updated_at: new Date().toISOString() });
    if (saveError) {
      setMuted(before);
      setError(true);
    }
  };

  return (
    <aside
      aria-labelledby="notification-settings"
      className="rounded-2xl border border-[#e8ede4] bg-white p-5 lg:sticky lg:top-6 lg:w-[360px] lg:shrink-0"
    >
      <h2 id="notification-settings" className="text-base font-bold text-[#111c0a]">
        {t("title")}
      </h2>
      <p className="mb-3 mt-1 text-[13px] leading-relaxed text-[#55664c]">
        {area === "admin" ? t("hintClub") : t("hintPlayer")}
      </p>
      <ul>
        {categories.map((c) => {
          const on = muted ? !muted.includes(c) : true;
          return (
            <li key={c} className="flex items-center justify-between gap-4 border-t border-[#eef2ea] py-3">
              <span id={`pref-${c}`}>
                <span className="block text-sm font-medium text-[#111c0a]">{t(`${area}.${c}.title`)}</span>
                <span className="block text-xs text-[#55664c]">{t(`${area}.${c}.desc`)}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`pref-${c}`}
                disabled={!muted}
                onClick={() => toggle(c)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-[#7aad12]" : "bg-[#d0d9c9]"}`}
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`}
                />
              </button>
            </li>
          );
        })}
        {area === "admin" && isOwner && (
          <li className="flex items-center justify-between gap-4 border-t border-[#eef2ea] py-3">
            <span>
              <span className="block text-sm font-medium text-[#111c0a]">{t("plan.title")}</span>
              <span className="block text-xs text-[#55664c]">{t("plan.desc")}</span>
            </span>
            <span className="text-xs font-semibold text-[#4d7a08]">{t("alwaysOn")}</span>
          </li>
        )}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {t("saveFailed")}
        </p>
      )}
    </aside>
  );
}
