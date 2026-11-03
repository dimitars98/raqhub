"use client";

import { dateLocale } from "@/lib/dateLocale";
import { format, isAfter, isBefore } from "date-fns";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Users,
  Grid3x3,
  ArrowRight,
  Minus,
} from "lucide-react";
import type {
  TodayBooking,
  RecentBooking,
  ActiveMember,
  CourtRow,
} from "./page";
import SportIcon from "@/components/ui/SportIcon";
import { useLabels } from "@/hooks/useLabels";
import { BOOKING_STATUS_DOT, bookingStatusTone } from "@/lib/badges";
import { initials } from "@/lib/avatar";
import type { BookingStatus } from "@/types/database";
import { bookingName } from "@/lib/bookingName";

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  clubName: string;
  todayBookings: TodayBooking[];
  thisWeekRevenue: number;
  revenueChange: number | null;
  revByDay: Record<string, number>;
  activeMembers: ActiveMember[];
  courts: CourtRow[];
  recentBookings: RecentBooking[];
  /** Getting-started checklist, shown under the greeting. */
  checklist?: React.ReactNode;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Helpers ────────────────────────────────────────────────────────────────

function isNowBetween(starts_at: string, ends_at: string) {
  const now = new Date();
  return isAfter(now, new Date(starts_at)) && isBefore(now, new Date(ends_at));
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  href,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent: string;
  href?: string;
}) {
  const inner = (
    <div
      className={`bg-white border border-[#e8ede4] rounded-2xl p-5 flex flex-col gap-3 ${
        href
          ? "hover:border-[#d6f09a] hover:shadow-sm transition-all cursor-pointer"
          : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#6e7f65] uppercase tracking-wider">
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}
        >
          <Icon size={15} strokeWidth={2} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-[#111c0a]">{value}</div>
        {sub && <div className="text-xs text-[#6e7f65] mt-1">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function RevenueBar({
  revByDay,
  max,
}: {
  revByDay: Record<string, number>;
  max: number;
}) {
  const dayLabels = useTranslations("analytics").raw("daysShort") as string[];
  return (
    <div className="flex items-end gap-1.5 h-16">
      {DAYS.map((d, di) => {
        const val = revByDay[d] ?? 0;
        const pct = max === 0 ? 0 : (val / max) * 100;
        return (
          <div key={d} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full relative flex items-end"
              style={{ height: 48 }}
            >
              <div
                className="w-full rounded-t-md bg-[#7aad12]/20 relative overflow-hidden"
                style={{ height: `${Math.max(pct, 4)}%` }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-[#7aad12] rounded-t-md transition-all duration-500"
                  style={{ height: pct > 0 ? "100%" : "0%" }}
                />
              </div>
            </div>
            <span className="text-[9px] text-[#6e7f65]">{dayLabels[di]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DashboardClient({
  clubName,
  checklist,
  todayBookings,
  thisWeekRevenue,
  revenueChange,
  revByDay,
  activeMembers,
  courts,
  recentBookings,
}: Props) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const labels = useLabels();
  const dfLocale = dateLocale(useLocale());
  const now = new Date();
  const maxRev = Math.max(...DAYS.map((d) => revByDay[d] ?? 0), 1);

  const upcomingToday = todayBookings
    .filter((b) => isAfter(new Date(b.ends_at), now))
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

  const completedToday = todayBookings.filter((b) =>
    isBefore(new Date(b.ends_at), now),
  ).length;

  const greeting =
    now.getHours() < 12
      ? t("greeting.morning")
      : now.getHours() < 17
        ? t("greeting.afternoon")
        : t("greeting.evening");

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-[#111c0a]">
          {greeting} 👋
        </h1>
        <p className="text-sm text-[#6e7f65] mt-1">
          {clubName} · {format(now, "EEEE, d MMMM yyyy", { locale: dfLocale })}
        </p>
      </div>
      {checklist}


      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t("stats.todaysBookings")}
          value={todayBookings.length}
          sub={`${completedToday} ${t("stats.completed")} · ${upcomingToday.length} ${t("stats.upcoming")}`}
          icon={CalendarDays}
          accent="bg-[#f3fbde] text-[#7aad12]"
          href="/admin/timetable"
        />
        <StatCard
          label={t("stats.weeklyRevenue")}
          value={`€${thisWeekRevenue.toFixed(0)}`}
          sub={
            revenueChange === null ? (
              t("stats.noLastWeek")
            ) : revenueChange > 0 ? (
              <span className="text-[#7aad12] flex items-center gap-1">
                <TrendingUp size={11} /> +{revenueChange.toFixed(1)}%{" "}
                {t("stats.vsLastWeek")}
              </span>
            ) : revenueChange < 0 ? (
              <span className="text-red-500 flex items-center gap-1">
                <TrendingDown size={11} /> {revenueChange.toFixed(1)}%{" "}
                {t("stats.vsLastWeek")}
              </span>
            ) : (
              <span className="text-[#6e7f65] flex items-center gap-1">
                <Minus size={11} /> {t("stats.sameAsLastWeek")}
              </span>
            )
          }
          icon={TrendingUp}
          accent="bg-[#e8f4fd] text-[#1a5ea8]"
        />
        <StatCard
          label={t("stats.activeMembers")}
          value={activeMembers.length}
          sub={t("stats.activeMembersSub")}
          icon={Users}
          accent="bg-[#f3fbde] text-[#7aad12]"
          href="/admin/members"
        />
        <StatCard
          label={t("stats.activeCourts")}
          value={courts.length}
          sub={
            <span className="inline-flex flex-wrap items-center gap-1">
              {[...new Set(courts.map((c) => c.sport))].map((s) => (
                <SportIcon key={s} sport={s} size={14} />
              ))}
              <span className="ml-0.5">{t("stats.available")}</span>
            </span>
          }
          icon={Grid3x3}
          accent="bg-[#e8ede4] text-[#3d4f35]"
          href="/admin/courts"
        />
      </div>

      {/* Middle row: revenue chart + today's schedule */}
      <div className="grid lg:grid-cols-5 gap-4 mb-4">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white border border-[#e8ede4] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-[#111c0a]">
                {t("sections.thisWeek")}
              </div>
              <div className="text-xs text-[#6e7f65]">
                {t("sections.revenueByDay")}
              </div>
            </div>
            <div className="text-lg font-bold text-[#7aad12]">
              €{thisWeekRevenue.toFixed(0)}
            </div>
          </div>
          <RevenueBar revByDay={revByDay} max={maxRev} />
        </div>

        {/* Today's schedule */}
        <div className="lg:col-span-3 bg-white border border-[#e8ede4] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-[#111c0a]">
                {t("sections.todaysSchedule")}
              </div>
              <div className="text-xs text-[#6e7f65]">
                {upcomingToday.length} {t("stats.upcoming")} · {completedToday}{" "}
                {t("stats.completed")}
              </div>
            </div>
            <Link
              href="/admin/timetable"
              className="text-xs text-[#7aad12] hover:text-[#3a7020] flex items-center gap-1 font-medium"
            >
              {t("sections.timetable")} <ArrowRight size={12} />
            </Link>
          </div>

          {upcomingToday.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays size={28} className="text-[#d6ddd0] mb-2" />
              <div className="text-sm text-[#6e7f65]">
                {t("sections.noUpcoming")}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {upcomingToday.map((b) => {
                const live = isNowBetween(b.starts_at, b.ends_at);
                const badgeClass = bookingStatusTone(b.status);
                const statusLabel = labels.bookingStatus(b.status);
                return (
                  <div
                    key={b.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                      live
                        ? "bg-[#f3fbde] border-[#d6f09a]"
                        : "bg-[#f8f9f7] border-transparent"
                    }`}
                  >
                    <div className="text-center w-14 flex-shrink-0">
                      <div className="text-[11px] font-semibold text-[#111c0a]">
                        {format(new Date(b.starts_at), "HH:mm")}
                      </div>
                      <div className="text-[10px] text-[#6e7f65]">
                        {format(new Date(b.ends_at), "HH:mm")}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-[#e8ede4] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#111c0a] truncate">
                        {bookingName(b, tc("walkIn"))}
                      </div>
                      <div className="text-[11px] text-[#6e7f65] truncate">
                        {b.court?.name} · {b.duration_min} min
                      </div>
                    </div>
                    {live ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-[#7aad12] bg-white border border-[#d6f09a] px-2 py-0.5 rounded-full flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#7aad12] animate-pulse" />
                        {t("status.live")}
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badgeClass}`}
                      >
                        {statusLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: recent bookings + members + courts */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Recent bookings */}
        <div className="lg:col-span-3 bg-white border border-[#e8ede4] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8ede4]">
            <div className="text-sm font-semibold text-[#111c0a]">
              {t("sections.recentBookings")}
            </div>
            <Link
              href="/admin/bookings"
              className="text-xs text-[#7aad12] hover:text-[#3a7020] flex items-center gap-1 font-medium"
            >
              {t("sections.viewAll")} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-[#e8ede4]">
            {recentBookings.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#6e7f65]">
                {t("sections.noBookings")}
              </div>
            ) : (
              recentBookings.map((b) => {
                const dotClass =
                  BOOKING_STATUS_DOT[b.status as BookingStatus] ?? BOOKING_STATUS_DOT.confirmed;
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-[#f8f9f7] transition-colors"
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-[#111c0a] truncate">
                        {bookingName(b, tc("walkIn"))}
                      </div>
                      <div className="text-[11px] text-[#6e7f65]">
                        {b.court?.name} ·{" "}
                        {format(new Date(b.starts_at), "d MMM, HH:mm", { locale: dfLocale })}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[13px] font-semibold text-[#111c0a]">
                        €{b.total_price.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[#6e7f65]">
                        {b.duration_min} min
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Members + courts */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Active members */}
          <div className="bg-white border border-[#e8ede4] rounded-2xl overflow-hidden flex-1">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e8ede4]">
              <div className="text-sm font-semibold text-[#111c0a]">
                {t("sections.members")}
              </div>
              <Link
                href="/admin/members"
                className="text-xs text-[#7aad12] hover:text-[#3a7020] flex items-center gap-1 font-medium"
              >
                {t("sections.viewAll")} <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-[#e8ede4]">
              {activeMembers.length === 0 ? (
                <div className="py-6 text-center text-sm text-[#6e7f65]">
                  {t("sections.noMembers")}
                </div>
              ) : (
                activeMembers.slice(0, 5).map((m) => {
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 px-5 py-2.5"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#111c0a] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                        {initials(m.full_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-[#111c0a] truncate">
                          {m.full_name}
                        </div>
                        <div className="text-[11px] text-[#6e7f65] truncate">
                          {m.plan?.name ?? "—"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {activeMembers.length > 5 && (
              <div className="px-5 py-2 border-t border-[#e8ede4]">
                <span className="text-[11px] text-[#6e7f65]">
                  +{activeMembers.length - 5}{" "}
                  {t("sections.moreMembers").replace(
                    "{count}",
                    String(activeMembers.length - 5),
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Courts quick view */}
          <div className="bg-white border border-[#e8ede4] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-[#111c0a]">
                {t("sections.courts")}
              </div>
              <Link
                href="/admin/courts"
                className="text-xs text-[#7aad12] hover:text-[#3a7020] flex items-center gap-1 font-medium"
              >
                {t("sections.manage")} <ArrowRight size={12} />
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {courts.length === 0 ? (
                <div className="text-sm text-[#6e7f65]">
                  {t("sections.noCourts")}
                </div>
              ) : (
                courts.slice(0, 4).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <SportIcon sport={c.sport} size={18} title={labels.sport(c.sport)} />
                    <span className="text-[13px] text-[#111c0a] flex-1 truncate">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-[#6e7f65]">
                      {labels.inOut(c.is_indoor)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
