"use client";

import { useEffect, useRef } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CreditCard,
  Crown,
  Globe,
  Share2,
  Grid3x3,
  LayoutDashboard,
  LogOut,
  Settings,
  Star,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "./SidebarContext";
import { TONES, type Role } from "@/types/tones";
import { LogoMark } from "@/components/ui/Logo";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

/**
 * All role-specific colors in one place.
 * `text` is darker than the brand color on purpose: lime (#7aad12) on a pale
 * background is too faint to read, so lime is used only for the bar and icon.
 */

/** A link is active on its own page and on anything below it (/admin/members/42). */
const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

interface SidebarContentProps {
  role: Role;
  userName: string;
  clubName?: string;
  nav: NavGroup[];
  pathname: string;
  homeHref: string;
  onNavClick: () => void;
  onSignOut: () => void;
  onClose?: () => void;
  playerLabel: string;
  signOutLabel: string;
  collapsed?: boolean;
  /** Keeps the sliding bar of the desktop and the mobile copy from interfering. */
  layoutGroupId: string;
}

function SidebarContent({
  role,
  userName,
  clubName,
  nav,
  pathname,
  homeHref,
  onNavClick,
  onSignOut,
  onClose,
  playerLabel,
  signOutLabel,
  collapsed = false,
  layoutGroupId,
}: SidebarContentProps) {
  const tc = useTranslations("common");
  const tone = TONES[role];
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Labels are never removed when collapsing. The sidebar gets narrower and
  // clips them (overflow-hidden), and they fade out. Icons keep their exact
  // position, so nothing jumps.
  const fade = `transition-opacity duration-150 ${collapsed ? "opacity-0" : "opacity-100"}`;

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-60"
      } flex h-full flex-col overflow-hidden border-r border-[#e8ede4] bg-white transition-[width] duration-200`}
    >
      {/* Logo */}
      <div
        className={`flex h-[60px] shrink-0 items-center border-b border-[#e8ede4] px-4 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            onClick={onNavClick}
            aria-label="ServeTime"
            className="inline-flex items-center gap-2 font-display text-[17px] font-extrabold tracking-tight text-[#111c0a]"
          >
            <LogoMark className="size-7" />
            {!collapsed && (
              <span>
                Serve<span className="text-[#7aad12]">Time</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <span
              className={`rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${tone.badge}`}
            >
              {role === "admin" ? "Admin" : playerLabel}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            data-drawer-close
            aria-label={tc("closeMenu")}
            className="grid size-9 place-items-center rounded-lg text-[#6e7f65] transition-colors hover:bg-[#f8f9f7] hover:text-[#111c0a] lg:hidden"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav
        aria-label={tc("mainNav")}
        className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3"
      >
        <LayoutGroup id={layoutGroupId}>
          {nav.map((group) => (
            <div key={group.group} className="mb-2">
              <div
                className={`px-2 py-2 text-[11px] font-bold tracking-[.08em] whitespace-nowrap text-[#6e7f65] uppercase ${fade}`}
              >
                {group.group}
              </div>

              {group.items.map(({ label, href, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavClick}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? label : undefined}
                    className={`relative mb-0.5 flex h-10 items-center gap-3 rounded-lg border px-3.5 text-sm whitespace-nowrap transition-colors duration-150 ${
                      active
                        ? `${tone.active} font-medium`
                        : // The transparent border keeps the text from shifting 1px when a link becomes active.
                          "border-transparent text-[#55664c] hover:bg-[#f8f9f7] hover:text-[#111c0a]"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="active-bar"
                        className={`absolute top-1/2 -left-px h-[60%] w-[3px] -translate-y-1/2 rounded-r-full ${tone.bar}`}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <Icon
                      size={18}
                      strokeWidth={2}
                      aria-hidden="true"
                      className={`shrink-0 ${active ? tone.accent : ""}`}
                    />
                    <span className={fade}>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </LayoutGroup>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#e8ede4] p-2">
        <div
          className={`flex items-center gap-2.5 px-2 py-2 ${collapsed ? "flex-col" : ""}`}
        >
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${tone.avatar}`}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-[#111c0a]">
                {userName}
              </div>
              <div className="truncate text-[11px] text-[#6e7f65]">
                {clubName ?? playerLabel}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onSignOut}
            title={signOutLabel}
            aria-label={signOutLabel}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[#6e7f65] transition-colors hover:bg-[#f8f9f7] hover:text-[#111c0a]"
          >
            <LogOut size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/**
 * The phone/tablet drawer. Besides sliding in, it behaves like a real dialog:
 * Escape closes it, Tab stays inside it, the page behind doesn't scroll,
 * and focus returns to the menu button when it closes.
 */
function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const tc = useTranslations("common");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current
      ?.querySelector<HTMLElement>("[data-drawer-close]")
      ?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (focusable.length === 0) return;
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

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={tc("menu")}
        >
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            className="relative z-10 flex shrink-0 shadow-2xl"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

interface SidebarProps {
  role: Role;
  userName: string;
  clubName?: string;
  /** Used for the link to the club's public page. */
  clubSlug?: string;
  /** The app owner (super_admin) also gets the owner page. */
  isOwner?: boolean;
}

export default function Sidebar({
  role,
  userName,
  clubName,
  clubSlug,
  isOwner = false,
}: SidebarProps) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("dashboard");

  const ADMIN_NAV: NavGroup[] = [
    ...(isOwner
      ? [
          {
            group: t("ownerGroup"),
            items: [{ label: t("ownerPage"), href: "/admin/owner", icon: Crown }],
          },
        ]
      : []),
    {
      group: t("overview"),
      items: [
        // The timetable is the screen staff use all day, so it comes first.
        {
          label: t("timetable"),
          href: "/admin/timetable",
          icon: CalendarRange,
        },
        { label: t("bookings"), href: "/admin/bookings", icon: CalendarDays },
        {
          label: t("dashboard"),
          href: "/admin/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      group: t("manage"),
      items: [
        { label: t("members"), href: "/admin/members", icon: Users },
        { label: t("plans"), href: "/admin/plans", icon: CreditCard },
        { label: t("coaches"), href: "/admin/coaches", icon: Star },
        { label: t("courts"), href: "/admin/courts", icon: Grid3x3 },
      ],
    },
    {
      group: t("club"),
      items: [
        { label: t("analytics"), href: "/admin/analytics", icon: BarChart3 },
        { label: t("settings"), href: "/admin/settings", icon: Settings },
        { label: t("share"), href: "/admin/share", icon: Share2 },
        // What visitors see before they have an account.
        ...(clubSlug
          ? [
              {
                label: t("publicPage"),
                href: `/clubs/${clubSlug}`,
                icon: Globe,
              },
            ]
          : []),
      ],
    },
  ];

  const MEMBER_NAV: NavGroup[] = [
    {
      group: t("play"),
      items: [
        { label: t("myBookings"), href: "/my-bookings", icon: CalendarDays },
        { label: t("bookACourt"), href: "/book", icon: BookOpen },
        { label: t("findACoach"), href: "/coaches", icon: Trophy },
      ],
    },
    {
      group: t("account"),
      items: [
        { label: t("profile"), href: "/profile", icon: Users },
        { label: t("membership"), href: "/membership", icon: CreditCard },
      ],
    },
  ];

  const nav = role === "admin" ? ADMIN_NAV : MEMBER_NAV;

  const handleSignOut = async () => {
    // Created here, not on every render.
    await createClient().auth.signOut();
    router.push("/");
    // Throws away pages cached for the signed-in user.
    router.refresh();
  };

  // Also closes the drawer on browser back/forward, not only on link taps.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const sharedProps = {
    role,
    userName,
    clubName,
    nav,
    pathname,
    // The logo keeps people inside the app instead of sending them to the public site.
    homeHref: role === "admin" ? "/admin/timetable" : "/my-bookings",
    onNavClick: closeMobile,
    onSignOut: handleSignOut,
    playerLabel: t("player"),
    signOutLabel: t("signOut"),
  };

  return (
    // reducedMotion="user": people who turned off animations in their system get none.
    <MotionConfig reducedMotion="user">
      {/* Desktop sidebar */}
      <div className="hidden shrink-0 lg:flex">
        <SidebarContent
          {...sharedProps}
          collapsed={collapsed}
          layoutGroupId="sidebar-desktop"
        />
      </div>

      {/* Phone / tablet drawer */}
      <MobileDrawer open={mobileOpen} onClose={closeMobile}>
        <SidebarContent
          {...sharedProps}
          onClose={closeMobile}
          layoutGroupId="sidebar-mobile"
        />
      </MobileDrawer>
    </MotionConfig>
  );
}
