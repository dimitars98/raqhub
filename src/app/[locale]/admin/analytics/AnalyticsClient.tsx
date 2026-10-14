"use client";

import { dateLocale } from "@/lib/dateLocale";
import { useLocale, useTranslations } from "next-intl";
import { useState, useMemo } from "react";
import { subDays, format, eachDayOfInterval } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Users,
  AlertCircle,
  Minus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { SPORT_EMOJI } from "@/lib/labels";
import { useLabels } from "@/hooks/useLabels";
import type { BookingStatus, Sport } from "@/types/database";
import { BOOKING_STATUS_HEX } from "@/lib/badges";

// ── Types ──────────────────────────────────────────────────────────────────

export type AnalyticsData = {
  totalRevenue: number;
  revenueChange: number | null;
  totalBookings: number;
  activeMembers: number;
  expiringSoon: number;
  revenueByDay: Record<string, number>;
  bookingsByStatus: Record<string, number>;
  revenueBySport: Record<string, number>;
  courtUtilization: { name: string; count: number; revenue: number }[];
  peakHours: number[][];
  membersByPlan: Record<string, number>;
  memberGrowth: { month: string; count: number }[];
};

type Range = "30" | "90" | "365";

// ── Constants ──────────────────────────────────────────────────────────────

// Chart colours (hex, for the chart library).
const SPORT_COLORS: Record<Sport, string> = {
  tennis: "#7aad12",
  padel: "#378add",
  pickleball: "#f59e0b",
};

const PLAN_COLORS = [
  "#7aad12",
  "#378add",
  "#f59e0b",
  "#a78bfa",
  "#f87171",
  "#6e7f65",
];

const HOURS = Array.from({ length: 15 }, (_, i) => `${i + 7}h`);

const TOOLTIP_STYLE = {
  background: "#fff",
  border: "0.5px solid #e8ede4",
  borderRadius: 12,
  fontSize: 12,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(val: number, total: number) {
  return total === 0 ? 0 : Math.round((val / total) * 100);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white border border-[#e8ede4] rounded-2xl p-5 flex flex-col gap-3">
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
        {sub && (
          <div className="text-xs text-[#6e7f65] mt-1 flex items-center gap-1">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#e8ede4] rounded-2xl p-5">
      <div className="mb-4">
        <div className="text-sm font-semibold text-[#111c0a]">{title}</div>
        {sub && <div className="text-xs text-[#6e7f65] mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function PeakHeatmap({ peakHours }: { peakHours: number[][] }) {
  const t = useTranslations("analytics");
  const maxVal = Math.max(...peakHours.flat(), 1);
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 480 }}>
        <div className="flex mb-1 ml-10">
          {HOURS.map((h, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[9px] text-[#6e7f65]"
            >
              {i % 2 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {(t.raw("daysShort") as string[]).map((day, di) => (
          <div key={di} className="flex items-center mb-0.5">
            <div className="w-10 text-[10px] text-[#6e7f65] flex-shrink-0">
              {day}
            </div>
            {peakHours[di].map((val, hi) => {
              const intensity = val / maxVal;
              const bg =
                val === 0
                  ? "#f4f6f2"
                  : `rgba(122, 173, 18, ${0.1 + intensity * 0.9})`;
              return (
                <div
                  key={hi}
                  className="flex-1 h-6 rounded-sm mx-[1px] flex items-center justify-center"
                  style={{ background: bg }}
                  title={t("heatmapCell", { day, hour: hi + 7, n: val })}
                >
                  {val > 0 && intensity > 0.5 && (
                    <span className="text-[8px] text-white font-bold">
                      {val}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-3 ml-10">
          <span className="text-[9px] text-[#6e7f65]">{t("low")}</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
            <div
              key={o}
              className="w-4 h-3 rounded-sm"
              style={{ background: `rgba(122, 173, 18, ${o})` }}
            />
          ))}
          <span className="text-[9px] text-[#6e7f65]">{t("high")}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const t = useTranslations("analytics");
  const dfLocale = dateLocale(useLocale());
  const labels = useLabels();
  const [range, setRange] = useState<Range>("30");

  const {
    totalRevenue,
    revenueChange,
    totalBookings,
    activeMembers,
    expiringSoon,
    revenueByDay,
    bookingsByStatus,
    revenueBySport,
    courtUtilization,
    peakHours,
    membersByPlan,
    memberGrowth,
  } = data;

  const revenueChartData = useMemo(() => {
    const days = eachDayOfInterval({
      start: subDays(new Date(), parseInt(range) - 1),
      end: new Date(),
    });
    const step = range === "365" ? 7 : range === "90" ? 3 : 1;
    return days
      .filter((_, i) => i % step === 0)
      .map((d) => ({
        date: format(d, "d MMM", { locale: dfLocale }),
        revenue: revenueByDay[format(d, "yyyy-MM-dd")] ?? 0,
      }));
  }, [range, revenueByDay, dfLocale]);

  const statusData = useMemo(
    () =>
      Object.entries(bookingsByStatus).map(([name, value]) => ({
        name,
        value,
        color: BOOKING_STATUS_HEX[name as BookingStatus] ?? "#e8ede4",
      })),
    [bookingsByStatus],
  );

  const sportData = useMemo(
    () =>
      Object.entries(revenueBySport)
        .map(([name, revenue]) => ({
          name: `${SPORT_EMOJI[name as Sport] ?? ""} ${labels.sport(name)}`,
          revenue,
          color: SPORT_COLORS[name as Sport] ?? "#7aad12",
        }))
        .sort((a, b) => b.revenue - a.revenue),
    [revenueBySport, labels],
  );

  const courtData = useMemo(
    () =>
      courtUtilization.slice(0, 8).map((c) => ({
        name: c.name,
        bookings: c.count,
        revenue: c.revenue,
      })),
    [courtUtilization],
  );

  const planData = useMemo(
    () =>
      Object.entries(membersByPlan)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value })),
    [membersByPlan],
  );

  const totalBookingsCount = Object.values(bookingsByStatus).reduce(
    (s, v) => s + v,
    0,
  );

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-semibold text-[#111c0a]">
            {t("analytics")}
          </h1>
          <p className="text-sm text-[#6e7f65] mt-1">
            {t("performanceOverviewForYourClub")}
          </p>
        </div>
        <div className="flex gap-1 bg-[#f4f6f2] p-1 rounded-xl">
          {(["30", "90", "365"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r
                  ? "bg-white text-[#111c0a] shadow-sm"
                  : "text-[#6e7f65] hover:text-[#111c0a]"
              }`}
            >
              {r === "365" ? t("oneYear") : t("days", { n: r })}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label={t("totalRevenue")}
          value={`€${totalRevenue.toFixed(0)}`}
          sub={
            revenueChange === null ? (
              t("vsPrevious")
            ) : revenueChange > 0 ? (
              <span className="text-[#7aad12] flex items-center gap-1">
                <TrendingUp size={11} />{" "}
                {t("changeUp", { pct: revenueChange.toFixed(1), days: range })}
              </span>
            ) : revenueChange < 0 ? (
              <span className="text-red-500 flex items-center gap-1">
                <TrendingDown size={11} />{" "}
                {t("changeDown", { pct: revenueChange.toFixed(1), days: range })}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Minus size={11} /> {t("same", { days: range })}
              </span>
            )
          }
          icon={TrendingUp}
          accent="bg-[#f3fbde] text-[#7aad12]"
        />
        <KpiCard
          label={t("totalBookings")}
          value={String(totalBookings)}
          sub={t("last12Months")}
          icon={CalendarDays}
          accent="bg-[#e8f4fd] text-[#1a5ea8]"
        />
        <KpiCard
          label={t("activeMembers")}
          value={String(activeMembers)}
          sub={t("allTime")}
          icon={Users}
          accent="bg-[#f3fbde] text-[#7aad12]"
        />
        <KpiCard
          label={t("expiringSoon")}
          value={String(expiringSoon)}
          sub={t("next30Days")}
          icon={AlertCircle}
          accent={
            expiringSoon > 0
              ? "bg-amber-50 text-amber-600"
              : "bg-[#e8ede4] text-[#6e7f65]"
          }
        />
      </div>

      {/* Revenue chart */}
      <SectionCard title={t("revenueOverTime")} sub={t("lastDays", { n: range })}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart
            data={revenueChartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7aad12" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#7aad12" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e8ede4"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6e7f65" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6e7f65" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `€${v}`}
              width={48}
            />
            <Tooltip
              formatter={(v) => {
                const num = Number(v ?? 0);
                return [`€${num.toFixed(2)}`, t("revenue")] as [string, string];
              }}
              contentStyle={TOOLTIP_STYLE}
              cursor={{ stroke: "#e8ede4", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#7aad12"
              strokeWidth={2}
              fill="url(#revGrad)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "#7aad12",
                stroke: "#fff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Bookings by status + Revenue by sport */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <SectionCard title={t("bookingsByStatus")} sub={t("allTime")}>
          {statusData.length === 0 ? (
            <div className="text-sm text-[#6e7f65] py-4">{t("noDataYet")}</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={68}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => {
                      const num = Number(v ?? 0);
                      return [
                        `${num} (${pct(num, totalBookingsCount)}%)`,
                        labels.bookingStatus(String(name)),
                      ] as [string, string];
                    }}
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: s.color }}
                    />
                    <span className="text-[#3d4f35] capitalize flex-1">
                      {labels.bookingStatus(s.name)}
                    </span>
                    <span className="font-medium text-[#111c0a]">
                      {s.value}
                    </span>
                    <span className="text-[#6e7f65]">
                      {pct(s.value, totalBookingsCount)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title={t("revenueBySport")} sub={t("allTime")}>
          {sportData.length === 0 ? (
            <div className="text-sm text-[#6e7f65] py-4">{t("noDataYet")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={sportData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#6e7f65" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#3d4f35" }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  formatter={(v) => {
                    const num = Number(v ?? 0);
                    return [`€${num.toFixed(2)}`, t("revenue")] as [
                      string,
                      string,
                    ];
                  }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {sportData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Peak hours heatmap */}
      <div className="mt-4">
        <SectionCard title={t("peakHours")} sub={t("bookingFrequencyByDayAnd")}>
          <PeakHeatmap peakHours={peakHours} />
        </SectionCard>
      </div>

      {/* Court utilization + Members */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <SectionCard
          title={t("courtUtilization")}
          sub={t("bookingsPerCourtAllTime")}
        >
          {courtData.length === 0 ? (
            <div className="text-sm text-[#6e7f65]">{t("noCourtData")}</div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(courtData.length * 36, 120)}
            >
              <BarChart
                data={courtData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#6e7f65" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#3d4f35" }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  formatter={(v, name) => {
                    const num = Number(v ?? 0);
                    return name === "revenue"
                      ? ([`€${num.toFixed(2)}`, t("revenue")] as [string, string])
                      : ([String(num), t("bookings")] as [string, string]);
                  }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="bookings" fill="#7aad12" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <div className="flex flex-col gap-4">
          {/* Members by plan */}
          <SectionCard title={t("membersByPlan")} sub={t("currentDistribution")}>
            {planData.length === 0 ? (
              <div className="text-sm text-[#6e7f65]">{t("noMembers")}</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={140}>
                  <PieChart>
                    <Pie
                      data={planData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={60}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {planData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PLAN_COLORS[i % PLAN_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => {
                        return [String(Number(v ?? 0)), String(name)] as [
                          string,
                          string,
                        ];
                      }}
                      contentStyle={TOOLTIP_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 flex-1">
                  {planData.map((p, i) => (
                    <div
                      key={p.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          background: PLAN_COLORS[i % PLAN_COLORS.length],
                        }}
                      />
                      <span className="text-[#3d4f35] flex-1 truncate">
                        {p.name}
                      </span>
                      <span className="font-medium text-[#111c0a]">
                        {p.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Member growth */}
          <SectionCard
            title={t("memberGrowth")}
            sub={t("cumulativeMembersOver12Months")}
          >
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart
                data={memberGrowth}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#378add" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#378add" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e8ede4"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#6e7f65" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6e7f65" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(v) => {
                    return [String(Number(v ?? 0)), t("members")] as [
                      string,
                      string,
                    ];
                  }}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#378add"
                  strokeWidth={2}
                  fill="url(#memberGrad)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "#378add",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
