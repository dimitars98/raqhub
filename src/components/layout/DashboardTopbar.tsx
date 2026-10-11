"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Bell, PanelLeft } from "lucide-react";
import LocaleSwitcher from "../ui/LocaleSwitcher";
import { useSidebar } from "./SidebarContext";

type TitleKey =
  | "dashboard"
  | "timetable"
  | "bookings"
  | "members"
  | "coaches"
  | "courts"
  | "analytics"
  | "settings"
  | "book"
  | "myBookings"
  | "profile"
  | "membership";

// URL segment → translation key
const TITLE_KEYS: Record<string, TitleKey> = {
  dashboard: "dashboard",
  timetable: "timetable",
  bookings: "bookings",
  members: "members",
  coaches: "coaches",
  courts: "courts",
  analytics: "analytics",
  settings: "settings",
  book: "book",
  "my-bookings": "myBookings",
  profile: "profile",
  membership: "membership",
};

const iconButton =
  "grid size-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-900";

export default function DashboardTopbar() {
  const pathname = usePathname();
  const t = useTranslations("dashboard.titles");
  const { toggle } = useSidebar();

  const segment = pathname.split("/").filter(Boolean).pop() ?? "";
  const titleKey = TITLE_KEYS[segment];
  const title = titleKey ? t(titleKey) : "ServeTime";

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-ink-100 bg-white px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle sidebar"
          title="Toggle sidebar (Ctrl+B)"
          className={iconButton}
        >
          <PanelLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <h1 className="truncate font-display text-base font-bold text-ink-900">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <LocaleSwitcher size="sm" />
        <button type="button" aria-label="Notifications" className={iconButton}>
          <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
