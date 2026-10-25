"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import LocaleSwitcher from "../ui/LocaleSwitcher";
import { useSidebar } from "./SidebarContext";
import NotificationBell from "../notifications/NotificationBell";
import type { Area } from "@/lib/notifications";
import Help from "./Help";

type TitleKey =
  | "dashboard"
  | "groups"
  | "matches"
  | "timetable"
  | "bookings"
  | "members"
  | "plans"
  | "coaches"
  | "courts"
  | "analytics"
  | "settings"
  | "share"
  | "book"
  | "myBookings"
  | "profile"
  | "membership"
  | "owner"
  | "tournaments"
  | "staff"
  | "notifications";

// URL segment → translation key
const TITLE_KEYS: Record<string, TitleKey> = {
  dashboard: "dashboard",
  groups: "groups",
  matches: "matches",
  timetable: "timetable",
  bookings: "bookings",
  members: "members",
  plans: "plans",
  coaches: "coaches",
  courts: "courts",
  analytics: "analytics",
  settings: "settings",
  share: "share",
  book: "book",
  "my-bookings": "myBookings",
  profile: "profile",
  membership: "membership",
  owner: "owner",
  tournaments: "tournaments",
  staff: "staff",
  notifications: "notifications",
};

const iconButton =
  "grid size-9 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-900";

export default function DashboardTopbar({
  userId,
  area,
}: {
  userId: string;
  area: Area;
}) {
  const pathname = usePathname();
  const t = useTranslations("dashboard.titles");
  const tc = useTranslations("common");
  const { toggle } = useSidebar();

  // The deepest part of the path with a title: /admin/tournaments/<id> → "tournaments".
  const titleKey = pathname
    .split("/")
    .filter(Boolean)
    .reverse()
    .map((segment) => TITLE_KEYS[segment])
    .find(Boolean);
  const title = titleKey ? t(titleKey) : "Kortello";

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-ink-100 bg-white px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={tc("toggleSidebar")}
          title={tc("toggleSidebarHint")}
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
        <NotificationBell userId={userId} area={area} />
        <Help />
      </div>
    </header>
  );
}
