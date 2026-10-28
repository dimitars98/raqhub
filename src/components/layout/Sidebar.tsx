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
  Swords,
  Trophy,
  Layers,
  Shuffle,
  UserPlus,
  Users,
  X,
  UsersRound,
  CalendarCheck,
} from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "./SidebarContext";
import type { AreaRole } from "@/types/tones";
import { LogoMark } from "@/components/ui/Logo";
import { initials } from "@/lib/avatar";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

// The sidebar is dark: the page's darkest green with a soft lime glow at the
// top and darker green at the bottom, so it reads like a gradient. Faint
// court lines sit in the bottom corner, like on the featured pricing card.
const SIDEBAR_BG = {
  backgroundColor: "#111c0a",
  backgroundImage: [
    "radial-gradient(120% 55% at 0% 0%, rgba(168,216,50,0.16), transparent 60%)",
    "linear-gradient(180deg, rgba(17,28,10,0) 40%, #0a1205 100%)",
  ].join(", "),
};

/** A link is active on its own page and on anything below it (/admin/members/42). */
const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

interface SidebarContentProps {
  role: AreaRole;
  userName: string;
  clubName?: string;
  nav: NavGroup[];
  pathname: string;
  homeHref: string;
  onNavClick: () => void;
  onSignOut: () => void;
  onClose?: () => void;
  /** Shown under the name when there is no club name. */
  playerLabel: string;
  /** "Admin", "Staff" or "Player" next to the logo. */
  badgeLabel: string;
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
  badgeLabel,
  signOutLabel,
  collapsed = false,
  layoutGroupId,
}: SidebarContentProps) {
  const tc = useTranslations("common");
  const userInitials = initials(userName);

  // Labels are never removed when collapsing. The sidebar gets narrower and
  // clips them (overflow-hidden), and they fade out. Icons keep their exact
  // position, so nothing jumps.
  const fade = `transition-opacity duration-150 ${collapsed ? "opacity-0" : "opacity-100"}`;

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-60"
      } relative isolate flex h-full flex-col overflow-hidden border-r border-white/5 text-white transition-[width] duration-200`}
      style={SIDEBAR_BG}
      data-role={role}
    >
      {/* Faint court lines in the bottom corner */}
      <svg
        aria-hidden="true"
        viewBox="0 0 200 200"
        fill="none"
        className="pointer-events-none absolute -right-16 -bottom-14 -z-10 size-64 -rotate-12 text-[#a8d832] opacity-[0.07]"
      >
        <g stroke="currentColor" strokeWidth="3">
          <rect x="20" y="20" width="160" height="160" />
          <line x1="50" y1="20" x2="50" y2="180" />
          <line x1="150" y1="20" x2="150" y2="180" />
          <line x1="50" y1="100" x2="150" y2="100" />
          <line x1="100" y1="100" x2="100" y2="180" />
        </g>
      </svg>

      {/* Logo */}
      <div
        className={`flex h-[60px] shrink-0 items-center border-b border-white/10 px-4 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div className="flex items-center gap-2">
          <Link
            href={homeHref}
            onClick={onNavClick}
            aria-label="Kortello"
            className="inline-flex items-center gap-2 font-display text-[17px] font-extrabold tracking-tight text-white"
          >
            <LogoMark className="size-7" />
            {!collapsed && (
              <span>
                Kort<span className="text-[#a8d832]">ello</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <span
              className={`whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                role === "member"
                  ? // Players: blue, so the two sides of the app are told apart at a glance.
                    "border-[#378add]/40 bg-[#378add]/15 text-[#8cc8f5]"
                  : "border-white/10 bg-white/[0.08] text-[#a8d832]"
              }`}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            data-drawer-close
            aria-label={tc("closeMenu")}
            className="grid size-9 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
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
                className={`px-2 py-2 text-[11px] font-bold tracking-[.08em] whitespace-nowrap text-white/40 uppercase ${fade}`}
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
                    className={`group relative mb-0.5 flex h-10 items-center gap-3 rounded-lg px-3.5 text-sm whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#a8d832]/60 focus-visible:outline-none ${
                      active
                        ? "font-semibold text-[#111c0a]"
                        : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    {/* The lime pill slides to the page you open. */}
                    {active && (
                      <motion.span
                        layoutId="active-pill"
                        className="absolute inset-0 -z-10 rounded-lg bg-[#a8d832] shadow-[0_6px_18px_-8px_rgba(168,216,50,0.7)]"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 34,
                        }}
                      />
                    )}
                    <Icon
                      size={18}
                      strokeWidth={2}
                      aria-hidden="true"
                      className={`shrink-0 ${active ? "" : "text-white/50 transition-colors group-hover:text-[#a8d832]"}`}
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
      <div className="shrink-0 border-t border-white/10 p-2">
        <div
          className={`flex items-center gap-2.5 px-2 py-2 ${collapsed ? "flex-col" : ""}`}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-[#a8d832] ring-1 ring-white/15">
            {userInitials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-white">
                {userName}
              </div>
              <div className="truncate text-[11px] text-white/50">
                {clubName ?? playerLabel}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onSignOut}
            title={signOutLabel}
            aria-label={signOutLabel}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
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
          className="fixed inset-0 z-999 flex lg:hidden"
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
  role: AreaRole;
  userName: string;
  clubName?: string;
  /** Used for the link to the club's public page. */
  clubSlug?: string;
  /**
   * You, the person who runs Kortello. Gets the Kortello screens, plus the
   * club screens only if this account also has a club of its own.
   */
  isSuperAdmin?: boolean;
  /** Staff of a club: only timetable, bookings and members. */
  isStaff?: boolean;
  /** A player who is also staff: a link to the club's admin screens. */
  staffLink?: boolean;
}

export default function Sidebar({
  role,
  userName,
  clubName,
  clubSlug,
  isSuperAdmin = false,
  isStaff = false,
  staffLink = false,
}: SidebarProps) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("dashboard");

  // Super admin: the screens for running Kortello itself.
  const SUPER_ADMIN_NAV: NavGroup[] = [
    {
      group: t("ownerGroup"),
      items: [{ label: t("ownerPage"), href: "/admin/owner", icon: Crown }],
    },
  ];

  // Club admin: the person who signed their club up and runs it.
  const CLUB_ADMIN_NAV: NavGroup[] = [
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
        { label: t("groups"), href: "/admin/groups", icon: UsersRound },
        { label: t("openMatches"), href: "/admin/matches", icon: Swords },
        { label: t("courts"), href: "/admin/courts", icon: Grid3x3 },
        { label: t("leagues"), href: "/admin/leagues", icon: Layers },
        { label: t("americano"), href: "/admin/americano", icon: Shuffle },
        { label: t("tournaments"), href: "/admin/tournaments", icon: Trophy },
      ],
    },
    {
      group: t("club"),
      items: [
        { label: t("analytics"), href: "/admin/analytics", icon: BarChart3 },
        { label: t("settings"), href: "/admin/settings", icon: Settings },
        { label: t("staff"), href: "/admin/staff", icon: UserPlus },
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

  // Staff see only the screens they can use.
  const STAFF_NAV: NavGroup[] = [
    {
      group: t("overview"),
      items: [
        {
          label: t("timetable"),
          href: "/admin/timetable",
          icon: CalendarRange,
        },
        { label: t("bookings"), href: "/admin/bookings", icon: CalendarDays },
        { label: t("members"), href: "/admin/members", icon: Users },
        { label: t("groups"), href: "/admin/groups", icon: UsersRound },
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
        { label: t("bookACourt"), href: "/book", icon: CalendarCheck },
        { label: t("openMatches"), href: "/matches", icon: Swords },
        { label: t("leagues"), href: "/leagues", icon: Layers },
        { label: t("findACoach"), href: "/coaches", icon: Trophy },
        { label: t("myGroups"), href: "/groups", icon: UsersRound },
      ],
    },
    {
      group: t("account"),
      items: [
        { label: t("profile"), href: "/profile", icon: Users },
        { label: t("membership"), href: "/membership", icon: CreditCard },
      ],
    },
    ...(staffLink
      ? [
          {
            group: t("club"),
            items: [
              {
                label: t("manageClub"),
                href: "/admin/timetable",
                icon: CalendarRange,
              },
            ],
          },
        ]
      : []),
  ];

  // A super admin who also runs a club (e.g. a test club) gets both.
  const hasClub = !!clubSlug;
  const nav =
    role !== "admin"
      ? MEMBER_NAV
      : isStaff
        ? STAFF_NAV
        : isSuperAdmin
          ? [...SUPER_ADMIN_NAV, ...(hasClub ? CLUB_ADMIN_NAV : [])]
          : CLUB_ADMIN_NAV;

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
    homeHref:
      role !== "admin"
        ? "/my-bookings"
        : isSuperAdmin && !hasClub
          ? "/admin/owner"
          : "/admin/timetable",
    onNavClick: closeMobile,
    onSignOut: handleSignOut,
    playerLabel: isSuperAdmin ? t("superAdmin") : t("player"),
    badgeLabel:
      role !== "admin"
        ? t("player")
        : isStaff
          ? t("staff")
          : isSuperAdmin
            ? t("superAdmin")
            : t("clubAdmin"),
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
